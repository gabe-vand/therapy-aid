import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as repo_focus from '@/repositories/focus';
import * as svc_claude from '@/services/common/svc-claude';
import { sqlite } from '@/services/common/svc-db';
import { clampFocus, getLatestFocus, regenerateFocus } from '@/services/focus/focus';
import type { FocusReply } from '@/services/focus/prompts';
import { resetDatabase, seedFocus, seedProblem, seedSession } from '../../helpers/hlp-db';

const item = (over: Partial<FocusReply['items'][number]> = {}): FocusReply['items'][number] => ({
    title: 'Protect your wind-down hour',
    why: 'In your Sept 11 session David suggested a worry list before bed.',
    action: 'Write the worry list at 10pm and charge the phone in the hall.',
    problem_id: null,
    ...over,
});
const reply = (over: Partial<FocusReply> = {}): FocusReply => ({ headline: 'Protect your wind-down hour this week.', items: [item()], ...over });

let claude: ReturnType<typeof spyOn>;
beforeEach(() => {
    resetDatabase();
    claude = spyOn(svc_claude, 'completeStructured').mockResolvedValue(reply());
});
afterEach(() => claude.mockRestore());

describe('getLatestFocus', () => {
    it('is null before the first snapshot', () => {
        expect(getLatestFocus()).toBeNull();
    });

    it('reads the newest snapshot, defaulting a missing problem_id to null', () => {
        seedFocus({ headline: 'Old', items: [] });
        seedFocus({ headline: 'New', items: [{ title: 'T', why: 'W', action: 'A' }] });
        expect(getLatestFocus()).toMatchObject({ headline: 'New', session_id: null, items: [{ title: 'T', why: 'W', action: 'A', problem_id: null }] });
    });

    it('is null when the stored JSON is unreadable', () => {
        const err = spyOn(console, 'error').mockImplementation(() => {});
        repo_focus.insertFocusSnapshot({ session_id: null, content_json: 'not json' });
        expect(getLatestFocus()).toBeNull();
        err.mockRestore();
    });
});

describe('regenerateFocus', () => {
    it('stores { headline, items } as content_json and returns the snapshot', async () => {
        const session = seedSession();
        const snapshot = await regenerateFocus(session.id);
        expect(snapshot).toMatchObject({ session_id: session.id, headline: 'Protect your wind-down hour this week.' });
        expect(snapshot.items).toEqual([item()]);
        const stored = repo_focus.selectLatestFocusSnapshot()!;
        expect(JSON.parse(stored.content_json)).toEqual({ headline: snapshot.headline, items: snapshot.items });
        expect(getLatestFocus()).toEqual(snapshot);
    });

    it('calls the focus task with the persona and context pack as cached blocks and today in the user message', async () => {
        seedProblem({ title: 'Racing mind at night' });
        await regenerateFocus();
        const opts = claude.mock.calls[0]![0] as Parameters<typeof svc_claude.completeStructured>[0];
        expect(opts.task).toBe('focus');
        expect(opts.system).toHaveLength(2);
        expect(opts.system.every((b) => b.cache_control?.type === 'ephemeral')).toBe(true);
        expect(opts.system[0]!.text).toContain('Focus');
        expect(opts.system[1]!.text).toContain('Racing mind at night');
        const user = opts.messages[0]!.content as string;
        expect(user).toContain('Today is');
        expect(user).toContain('asked for a fresh look');
    });

    it('tells the model which session triggered it', async () => {
        const session = seedSession();
        await regenerateFocus(session.id);
        const user = (claude.mock.calls[0]![0] as Parameters<typeof svc_claude.completeStructured>[0]).messages[0]!.content as string;
        expect(user).toContain(`[session #${session.id}]`);
    });

    it('lists stale problems in the request', async () => {
        const old = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString();
        const stale = seedProblem({ title: 'Procrastination', last_discussed_at: old });
        sqlite.run('update problems set created_at = ? where id = ?', [old, stale.id]); // created_at is "now" from the repository
        seedProblem({ title: 'Fresh one' });
        await regenerateFocus();
        const user = (claude.mock.calls[0]![0] as Parameters<typeof svc_claude.completeStructured>[0]).messages[0]!.content as string;
        expect(user).toContain(`Procrastination [problem #${stale.id}] - untouched for 50 days`);
        expect(user).not.toContain('Fresh one');
    });

    it('counts stale days from the newest touch, so a recent Keep counts (as the staleness rule does)', async () => {
        const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const kept = seedProblem({ title: 'Kept a while back', last_discussed_at: ago(100), last_reviewed_at: ago(40) });
        sqlite.run('update problems set created_at = ? where id = ?', [ago(200), kept.id]);
        await regenerateFocus();
        const user = (claude.mock.calls[0]![0] as Parameters<typeof svc_claude.completeStructured>[0]).messages[0]!.content as string;
        expect(user).toContain(`Kept a while back [problem #${kept.id}] - untouched for 40 days`);
    });

    it('passes a real problem_id through, nulls an unknown or non-active one', async () => {
        const active = seedProblem({ title: 'Active' });
        const resolved = seedProblem({ title: 'Done', status: 'resolved' });
        claude.mockResolvedValue(reply({ items: [item({ problem_id: active.id }), item({ title: 'B', problem_id: resolved.id }), item({ title: 'C', problem_id: 9999 })] }));
        const snapshot = await regenerateFocus();
        expect(snapshot.items.map((i) => i.problem_id)).toEqual([active.id, null, null]);
    });

    it('clamps to 3 items, trims text, and drops items with no title or action', async () => {
        claude.mockResolvedValue(
            reply({
                headline: '  Headline  ',
                items: [item({ title: ' One ' }), item({ title: '' }), item({ title: 'Two', action: '  ' }), item({ title: 'Three' }), item({ title: 'Four' }), item({ title: 'Five' })],
            }),
        );
        const snapshot = await regenerateFocus();
        expect(snapshot.headline).toBe('Headline');
        expect(snapshot.items.map((i) => i.title)).toEqual(['One', 'Three', 'Four']);
    });

    it('appends a snapshot each time and the newest wins', async () => {
        await regenerateFocus();
        claude.mockResolvedValue(reply({ headline: 'Second' }));
        await regenerateFocus();
        expect(getLatestFocus()!.headline).toBe('Second');
    });

    it('stores nothing when the model returns an empty focus', async () => {
        claude.mockResolvedValue(reply({ items: [] }));
        await expect(regenerateFocus()).rejects.toBeInstanceOf(svc_claude.AiOutputError);
        expect(getLatestFocus()).toBeNull();
    });

    it('stores nothing and rethrows when Claude fails', async () => {
        claude.mockRejectedValue(new svc_claude.AiNotConfiguredError());
        await expect(regenerateFocus()).rejects.toBeInstanceOf(svc_claude.AiNotConfiguredError);
        expect(getLatestFocus()).toBeNull();
    });

    it('ignores a session id that does not exist rather than failing the foreign key', async () => {
        const snapshot = await regenerateFocus(4242);
        expect(snapshot.session_id).toBeNull();
    });
});

describe('clampFocus', () => {
    it('keeps problem ids only from the known set', () => {
        const out = clampFocus(reply({ items: [item({ problem_id: 1 }), item({ title: 'B', problem_id: 2 })] }), new Set([2]));
        expect(out.items.map((i) => i.problem_id)).toEqual([null, 2]);
    });
});
