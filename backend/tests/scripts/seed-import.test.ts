import { describe, expect, it } from 'bun:test';
import { createApi, type Api } from '../../../scripts/lib/seed-client';
import { importJournal, importProfile, importTherapyNotes, type ImportDeps } from '../../../scripts/lib/seed-import';
import { occurredAt } from '../../../scripts/lib/seed-parse';

// The importer's steps against a fake in-memory server: ordering, idempotency, failure handling.

interface FakeSession {
    id: number;
    occurred_at: string;
    status: string;
    title: string | null;
    error?: string | null;
    polls_left: number;
}

const NOTES = '## 2026-09-11\nsecond\n\n## 2026-08-06\nfirst\n\n## 2026-10-23\nthird\n';

/** A fake API: sessions take `polls` GETs to finish; `fail_day` makes that day's session fail. */
const fake_server = (opts: { sessions?: FakeSession[]; journal?: { id: number; occurred_at: string }[]; profile?: string; polls?: number; fail_day?: string } = {}) => {
    const state = { sessions: opts.sessions ?? [], journal: opts.journal ?? [], profile: opts.profile ?? '', posts: [] as string[], logs: [] as string[] };
    const api: Api = {
        get: async (path: string) => {
            if (path === '/settings/profile') return { profile: state.profile } as never;
            if (path === '/journal') return state.journal as never;
            if (path === '/sessions') return [...state.sessions].reverse() as never;
            const s = state.sessions.find((x) => `/sessions/${x.id}` === path)!;
            if (s.status !== 'ready' && s.status !== 'failed' && --s.polls_left <= 0) {
                const bad = opts.fail_day && s.occurred_at === occurredAt(opts.fail_day);
                Object.assign(s, bad ? { status: 'failed', error: 'The AI model declined to answer this request.' } : { status: 'ready', title: `Title ${s.id}` });
            }
            return { ...s } as never;
        },
        post: async (path: string, body?: unknown) => {
            const b = body as { occurred_at: string; notes?: string; body?: string };
            if (path === '/sessions/notes') {
                const s: FakeSession = { id: state.sessions.length + 1, occurred_at: b.occurred_at, status: 'uploaded', title: null, polls_left: opts.polls ?? 2 };
                state.sessions.push(s);
                state.posts.push(`session ${b.notes!.trim()}`);
                return s as never;
            }
            if (path === '/journal') {
                state.journal.push({ id: state.journal.length + 1, occurred_at: b.occurred_at });
                state.posts.push(`journal ${b.body}`);
                return {} as never;
            }
            const retry = /^\/sessions\/(\d+)\/retry$/.exec(path);
            if (retry) {
                Object.assign(
                    state.sessions.find((x) => x.id === Number(retry[1]))!,
                    { status: 'summarizing', error: null, polls_left: 1 },
                );
                state.posts.push(`retry ${retry[1]}`);
            }
            return {} as never;
        },
        put: async (_path: string, body?: unknown) => {
            state.profile = (body as { profile: string }).profile;
            state.posts.push('profile');
            return {} as never;
        },
    };
    const deps: ImportDeps = { api, log: (l) => state.logs.push(l), sleep: async () => {}, poll_ms: 0 };
    return { state, deps };
};

describe('importTherapyNotes', () => {
    it('posts oldest first, one at a time, waiting for each to be ready', async () => {
        const { state, deps } = fake_server();
        expect(await importTherapyNotes(deps, NOTES)).toBe(true);
        expect(state.posts).toEqual(['session first', 'session second', 'session third']);
        expect(state.sessions.every((s) => s.status === 'ready')).toBe(true);
    });

    it('is idempotent: a second run sends nothing', async () => {
        const { state, deps } = fake_server();
        await importTherapyNotes(deps, NOTES);
        const before = state.posts.length;
        expect(await importTherapyNotes(deps, NOTES)).toBe(true);
        expect(state.posts.length).toBe(before);
    });

    it('stops at the first failed session, then retries it on the next run', async () => {
        const { state, deps } = fake_server({ fail_day: '2026-09-11' });
        expect(await importTherapyNotes(deps, NOTES)).toBe(false);
        expect(state.posts).toEqual(['session first', 'session second']); // the third is never sent
        expect(state.logs.some((l) => l.includes('FAILED: The AI model declined'))).toBe(true);
        // Fixed server: same command resumes by retrying the failed one and sending the rest.
        const resumed = fake_server({ sessions: state.sessions });
        expect(await importTherapyNotes(resumed.deps, NOTES)).toBe(true);
        expect(resumed.state.posts).toEqual(['retry 2', 'session third']);
    });

    it('gives up with a clear error when a session never finishes', async () => {
        const { deps } = fake_server({ polls: 1_000_000 });
        await expect(importTherapyNotes({ ...deps, timeout_ms: -1 }, NOTES)).rejects.toThrow(/still "uploaded"/);
    });
});

describe('importJournal', () => {
    it('adds missing days only', async () => {
        const { state, deps } = fake_server({ journal: [{ id: 1, occurred_at: occurredAt('2026-08-06') }] });
        await importJournal(deps, NOTES);
        expect(state.posts).toEqual(['journal second', 'journal third']);
    });
});

describe('importProfile', () => {
    it('saves into an empty profile, leaves an edited one alone, overwrites on request', async () => {
        const empty = fake_server();
        await importProfile(empty.deps, ' About me ', false);
        expect(empty.state.profile).toBe('About me');

        const edited = fake_server({ profile: 'edited in the app' });
        await importProfile(edited.deps, 'About me', false);
        expect(edited.state.profile).toBe('edited in the app');
        await importProfile(edited.deps, 'About me', true);
        expect(edited.state.profile).toBe('About me');
    });
});

describe('createApi', () => {
    const stub = (res: Response) => (async () => res) as unknown as typeof fetch;

    it('unwraps the envelope and explains failures', async () => {
        const ok = createApi('http://x', stub(Response.json({ data: { a: 1 }, status_code: 200, message: 'OK' })));
        expect(await ok.get('/y')).toEqual({ a: 1 });
        const denied = createApi('http://x/api', stub(Response.json({ data: null, status_code: 401, message: 'UNAUTHORIZED' }, { status: 401 })));
        await expect(denied.get('/me')).rejects.toThrow(/HTTP 401.*UNAUTHORIZED.*tailnet/);
        const down = createApi('http://x', (async () => {
            throw new Error('refused');
        }) as unknown as typeof fetch);
        await expect(down.get('/me')).rejects.toThrow(/Could not reach http:\/\/x/);
    });
});
