// Problems as the API shows them: the stored row plus derived fields (is_stale, update_count,
// latest_update), the ordered list, the detail timeline, and the four things Gabe can do by hand —
// create, patch, add a progress note, press Keep. Session-driven changes live in the sessions
// module (apply-problems); everything here is the manual side. Every mutation answers with the
// fresh ProblemDetail (or null when the id doesn't exist) so the SPA can just replace its copy.
import type { Problem, ProblemDetail, ProblemStatus, ProblemUpdate } from '@therapy-aid/shared';
import * as repo_updates from '@/repositories/problem-updates';
import * as repo_problems from '@/repositories/problems';
import { isStale } from './staleness';

export interface ProblemChanges {
    title?: string;
    description?: string;
    status?: ProblemStatus;
}

const STATUS_ORDER: Record<ProblemStatus, number> = { active: 0, resolved: 1, discarded: 2 };

/** Newest activity first within a status; ties fall back to the older problem. */
const activityKey = (p: repo_problems.ProblemRow): string => p.last_discussed_at ?? p.created_at;

const toProblem = (row: repo_problems.ProblemRow, update_count: number, latest_update: string | null, now: number): Problem => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_discussed_at: row.last_discussed_at,
    last_reviewed_at: row.last_reviewed_at,
    origin_session_id: row.origin_session_id,
    is_stale: isStale(row, now),
    update_count,
    latest_update,
});

const toUpdate = (u: repo_updates.ProblemUpdateWithSession): ProblemUpdate => ({
    id: u.id,
    problem_id: u.problem_id,
    session_id: u.session_id,
    session_title: u.session_title,
    body: u.body,
    source: u.source,
    created_at: u.created_at,
});

/** Active first, then resolved, and discarded only with `include_discarded`. */
export const listProblems = (opts: { include_discarded?: boolean; now?: number } = {}): Problem[] => {
    const now = opts.now ?? Date.now();
    const statuses: ProblemStatus[] = opts.include_discarded ? ['active', 'resolved', 'discarded'] : ['active', 'resolved'];
    const counts = new Map(repo_updates.selectUpdateStats().map((s) => [s.problem_id, s.update_count]));
    const latest = new Map(repo_updates.selectLatestUpdateBodies().map((u) => [u.problem_id, u.body]));
    return repo_problems
        .selectProblemsByStatus(statuses)
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || activityKey(b).localeCompare(activityKey(a)) || a.id - b.id)
        .map((row) => toProblem(row, counts.get(row.id) ?? 0, latest.get(row.id) ?? null, now));
};

/** One problem with its full timeline (newest first, session titles joined), or null. */
export const getProblem = (id: number): ProblemDetail | null => {
    const row = repo_problems.selectProblemById(id);
    if (!row) return null;
    const updates = repo_updates.selectUpdatesForProblem(id).map(toUpdate);
    return { ...toProblem(row, updates.length, updates[0]?.body ?? null, Date.now()), updates };
};

/** A manually written problem: active, and not stale because created_at is now. */
export const createProblem = (input: { title: string; description: string }): ProblemDetail => {
    const row = repo_problems.insertProblem({ title: input.title, description: input.description });
    return getProblem(row.id)!;
};

/** Edits title / description / status. Bringing a problem back to active counts as a review,
    otherwise a long-resolved problem would reopen already stale. */
export const patchProblem = (id: number, changes: ProblemChanges): ProblemDetail | null => {
    const current = repo_problems.selectProblemById(id);
    if (!current) return null;
    const patch: repo_problems.ProblemPatch = { ...changes };
    if (changes.status === 'active' && current.status !== 'active') patch.last_reviewed_at = new Date().toISOString();
    if (Object.keys(patch).length > 0) repo_problems.updateProblem(id, patch);
    return getProblem(id);
};

/** Gabe's own progress note; it counts as discussing the problem today. */
export const addManualUpdate = (id: number, body: string): ProblemDetail | null => {
    if (!repo_problems.selectProblemById(id)) return null;
    repo_updates.insertProblemUpdate({ problem_id: id, body, source: 'manual' });
    repo_problems.updateProblem(id, { last_discussed_at: new Date().toISOString() });
    return getProblem(id);
};

/** "Yes, still relevant": stamps last_reviewed_at so the 30-day clock restarts. */
export const keepProblem = (id: number): ProblemDetail | null => {
    if (!repo_problems.updateProblem(id, { last_reviewed_at: new Date().toISOString() })) return null;
    return getProblem(id);
};
