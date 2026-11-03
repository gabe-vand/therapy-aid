import { beforeEach, describe, expect, it } from 'bun:test';
import * as repo_problems from '@/repositories/problems';
import { addManualUpdate, createProblem, getProblem, keepProblem, listProblems, patchProblem } from '@/services/problems/problems';
import { resetDatabase, seedProblem, seedSession, seedUpdate } from '../../helpers/hlp-db';

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number): string => new Date(Date.now() - days * DAY).toISOString();

beforeEach(() => resetDatabase());

describe('listProblems', () => {
    it('lists active first (newest activity first), then resolved, and hides discarded', () => {
        const old_active = seedProblem({ title: 'Old', last_discussed_at: ago(10) });
        const new_active = seedProblem({ title: 'New', last_discussed_at: ago(1) });
        const resolved = seedProblem({ title: 'Done', status: 'resolved', last_discussed_at: ago(0) });
        seedProblem({ title: 'Dropped', status: 'discarded' });
        expect(listProblems().map((p) => p.id)).toEqual([new_active.id, old_active.id, resolved.id]);
    });

    it('includes discarded, last, only when asked', () => {
        const a = seedProblem({ title: 'A' });
        const d = seedProblem({ title: 'D', status: 'discarded' });
        expect(listProblems({ include_discarded: true }).map((p) => p.id)).toEqual([a.id, d.id]);
    });

    it('derives update_count, latest_update and is_stale', () => {
        // Old enough that created_at (now) is not what keeps it fresh: pass an explicit later clock.
        const p = seedProblem({ last_discussed_at: ago(40) });
        seedUpdate(p.id, { body: 'first', created_at: ago(50) });
        seedUpdate(p.id, { body: 'second', created_at: ago(40) });
        const fresh = seedProblem({ title: 'Fresh', last_discussed_at: ago(1) });
        const rows = listProblems({ now: Date.now() + 45 * DAY });
        expect(rows.find((r) => r.id === p.id)).toMatchObject({ update_count: 2, latest_update: 'second', is_stale: true });
        expect(rows.find((r) => r.id === fresh.id)).toMatchObject({ update_count: 0, latest_update: null, is_stale: true });
        const today = listProblems();
        expect(today.find((r) => r.id === p.id)!.is_stale).toBe(false);
    });

    it('never marks resolved problems stale, however old', () => {
        seedProblem({ status: 'resolved', last_discussed_at: ago(300) });
        expect(listProblems({ now: Date.now() + 400 * DAY })[0]!.is_stale).toBe(false);
    });
});

describe('getProblem', () => {
    it('returns null for a missing id', () => {
        expect(getProblem(999)).toBeNull();
    });

    it('joins session titles onto the timeline, newest first', () => {
        const session = seedSession();
        const p = seedProblem();
        seedUpdate(p.id, { body: 'from the session', session_id: session.id, created_at: ago(20) });
        seedUpdate(p.id, { body: 'my own note', source: 'manual', created_at: ago(2) });
        const detail = getProblem(p.id)!;
        expect(detail.updates.map((u) => u.body)).toEqual(['my own note', 'from the session']);
        expect(detail.updates[0]).toMatchObject({ source: 'manual', session_id: null, session_title: null });
        expect(detail.updates[1]).toMatchObject({ source: 'ai', session_id: session.id, session_title: session.title });
        expect(detail.updates[1]!.session_title).toBeTruthy();
        expect(detail).toMatchObject({ update_count: 2, latest_update: 'my own note' });
    });
});

describe('createProblem', () => {
    it('makes an active, not-stale problem with no discussion yet', () => {
        const created = createProblem({ title: 'Procrastination', description: 'Starting is the hard part.' });
        expect(created).toMatchObject({ status: 'active', is_stale: false, last_discussed_at: null, update_count: 0, updates: [] });
    });
});

describe('patchProblem', () => {
    it('edits fields and returns null for a missing problem', () => {
        const p = seedProblem();
        expect(patchProblem(p.id, { title: 'Renamed', description: 'New words' })).toMatchObject({ title: 'Renamed', description: 'New words', status: 'active' });
        expect(patchProblem(999, { title: 'x' })).toBeNull();
    });

    it('an empty patch changes nothing', () => {
        const p = seedProblem();
        expect(patchProblem(p.id, {})!.title).toBe(p.title);
    });

    it('resolving leaves the review clock alone; reopening counts as a review', () => {
        const p = seedProblem({ last_discussed_at: ago(200) });
        expect(patchProblem(p.id, { status: 'resolved' })).toMatchObject({ status: 'resolved', last_reviewed_at: null, is_stale: false });
        const reopened = patchProblem(p.id, { status: 'active' })!;
        expect(reopened.last_reviewed_at).not.toBeNull();
        expect(reopened.is_stale).toBe(false);
    });
});

describe('addManualUpdate', () => {
    it('writes a manual note and bumps last_discussed_at to now', () => {
        const p = seedProblem({ last_discussed_at: ago(45) });
        const before = Date.now();
        const detail = addManualUpdate(p.id, 'Tried the worry list. Helped.')!;
        expect(detail.updates).toHaveLength(1);
        expect(detail.updates[0]).toMatchObject({ source: 'manual', session_id: null, body: 'Tried the worry list. Helped.' });
        expect(Date.parse(detail.last_discussed_at!)).toBeGreaterThanOrEqual(before);
    });

    it('returns null and writes nothing for a missing problem', () => {
        expect(addManualUpdate(999, 'x')).toBeNull();
    });
});

describe('keepProblem', () => {
    it('stamps last_reviewed_at, restarting the 30-day clock, without adding a note', () => {
        const p = seedProblem({ last_discussed_at: ago(60) });
        const later = Date.now() + 29 * DAY;
        expect(listProblems({ now: later + 2 * DAY })[0]!.is_stale).toBe(true);
        const kept = keepProblem(p.id)!;
        expect(kept.update_count).toBe(0);
        expect(kept.last_reviewed_at).not.toBeNull();
        expect(listProblems({ now: later })[0]!.is_stale).toBe(false);
        expect(repo_problems.selectProblemById(p.id)!.last_discussed_at).toBe(p.last_discussed_at);
    });

    it('returns null for a missing problem', () => {
        expect(keepProblem(999)).toBeNull();
    });
});
