// The importer's steps (profile, journal, therapy notes), written against the small Api interface
// so a fake can drive them in tests. Every step is idempotent: it asks the server what already
// exists (by local calendar day) and only sends what is missing.
import { ApiError, type Api } from './seed-client';
import { localDay, occurredAt, splitDated } from './seed-parse';

export interface ImportDeps {
    api: Api;
    log: (line: string) => void;
    sleep: (ms: number) => Promise<void>;
    /** ms between polls of a processing session (default 3000). */
    poll_ms?: number;
    /** give up waiting on one session after this long (default 15 minutes). */
    timeout_ms?: number;
}

interface Profile {
    profile: string;
}
interface Dated {
    id: number;
    occurred_at: string;
}
interface SessionItem extends Dated {
    status: string;
    title: string | null;
    error?: string | null;
}

const TERMINAL = new Set(['ready', 'failed']);

/** Imports the About-me text. Never clobbers a profile edited in the app unless `overwrite`. */
export const importProfile = async (deps: ImportDeps, text: string, overwrite: boolean): Promise<void> => {
    const { api, log } = deps;
    const next = text.trim();
    const current = (await api.get<Profile>('/settings/profile')).profile.trim();
    if (current === next) return log('profile    already up to date');
    if (current && !overwrite) return log('profile    the app already has a different profile - left alone (use --overwrite-profile to replace it)');
    await api.put('/settings/profile', { profile: next });
    log(`profile    saved (${next.length} chars)`);
};

/** Imports journal entries, oldest first, skipping any day that already has an entry. */
export const importJournal = async (deps: ImportDeps, markdown: string): Promise<void> => {
    const { api, log } = deps;
    const entries = splitDated(markdown);
    const have = new Set((await api.get<Dated[]>('/journal')).map((e) => localDay(e.occurred_at)));
    let added = 0;
    for (const [i, entry] of entries.entries()) {
        const tag = `journal    [${i + 1}/${entries.length}] ${entry.date}`;
        if (have.has(entry.date)) {
            log(`${tag}  exists, skipped`);
            continue;
        }
        await api.post('/journal', { occurred_at: occurredAt(entry.date), body: entry.body });
        added++;
        log(`${tag}  added (${entry.body.length} chars)`);
    }
    log(`journal    done: ${added} added, ${entries.length - added} already there`);
};

/** Polls one session until ready or failed; tolerates a few failed polls (an API restart). Returns the final item. */
const waitForSession = async (deps: ImportDeps, id: number, label: string): Promise<SessionItem> => {
    const { api, log, sleep, poll_ms = 3000, timeout_ms = 15 * 60_000 } = deps;
    const started = Date.now();
    let last_status = '';
    let misses = 0;
    for (;;) {
        try {
            const session = await api.get<SessionItem>(`/sessions/${id}`);
            misses = 0;
            if (session.status !== last_status) {
                last_status = session.status;
                log(`${label}  ${session.status}...`);
            }
            if (TERMINAL.has(session.status)) return session;
        } catch (e) {
            if (!(e instanceof ApiError) || ++misses >= 5) throw e;
        }
        if (Date.now() - started > timeout_ms) throw new Error(`${label}  still "${last_status}" after ${Math.round(timeout_ms / 60_000)} min - check the api logs; re-running resumes`);
        await sleep(poll_ms);
    }
};

/**
 * Imports therapy notes strictly oldest first, waiting for each to finish processing before the
 * next is sent (problem mapping reads the previous sessions' problems). Stops at the first failure
 * and returns false; returns true when everything is in.
 */
export const importTherapyNotes = async (deps: ImportDeps, markdown: string): Promise<boolean> => {
    const { api, log } = deps;
    const entries = splitDated(markdown);
    const existing = new Map<string, SessionItem>();
    // The list is newest first; walking it backwards lets the oldest session win a shared day.
    for (const s of (await api.get<SessionItem[]>('/sessions')).slice().reverse()) if (!existing.has(localDay(s.occurred_at))) existing.set(localDay(s.occurred_at), s);
    let sent = 0;
    for (const [i, entry] of entries.entries()) {
        const label = `sessions   [${i + 1}/${entries.length}] ${entry.date}`;
        const found = existing.get(entry.date);
        let session: SessionItem;
        if (!found) {
            const created = await api.post<SessionItem>('/sessions/notes', { occurred_at: occurredAt(entry.date), notes: entry.body });
            sent++;
            log(`${label}  sent (${entry.body.length} chars); processing takes a minute or two`);
            session = await waitForSession(deps, created.id, label);
        } else if (found.status === 'ready') {
            log(`${label}  exists, skipped`);
            continue;
        } else if (found.status === 'failed') {
            log(`${label}  failed earlier - retrying`);
            await api.post(`/sessions/${found.id}/retry`);
            session = await waitForSession(deps, found.id, label);
        } else if (found.status === 'recording') {
            log(`${label}  a recording already exists for this day, skipped`);
            continue;
        } else {
            log(`${label}  already processing, waiting`);
            session = await waitForSession(deps, found.id, label);
        }
        if (session.status === 'failed') {
            log(`${label}  FAILED: ${session.error ?? 'unknown error'}`);
            log('sessions   stopped. Fix the cause (e.g. ANTHROPIC_API_KEY in ~/therapy-aid.env) and run the same command again; finished sessions are skipped.');
            return false;
        }
        log(`${label}  ready${session.title ? `: ${session.title}` : ''}`);
    }
    log(`sessions   done: ${sent} sent, ${entries.length - sent} already there`);
    return true;
};
