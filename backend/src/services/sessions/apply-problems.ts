// Writes a ProblemExtraction to the problems tables. Re-processing a session replaces what it
// wrote before (deleteUpdatesForSession), so retry is idempotent; a "new" problem whose title
// matches an existing one becomes an update instead of a duplicate; last_discussed_at only ever
// moves forward; and an id the model made up is skipped with a log line, never a crash.
import * as repo_updates from '@/repositories/problem-updates';
import * as repo_problems from '@/repositories/problems';
import type { ProblemRow } from '@/repositories/problems';
import type { SessionRow } from '@/repositories/sessions';
import type { ProblemExtraction } from './prompts-map';

export interface ApplyResult {
    updated: number;
    created: number;
    resolved: number;
    skipped: number;
}

const normTitle = (title: string): string =>
    title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

/** Applies `extraction` for `session`: notes dated at the session, discussion dates bumped
    forward, new problems opened, resolved suggestions honoured. */
export const applyProblemUpdates = (session: SessionRow, extraction: ProblemExtraction): ApplyResult => {
    repo_updates.deleteUpdatesForSession(session.id);
    const result: ApplyResult = { updated: 0, created: 0, resolved: 0, skipped: 0 };
    const live = new Map<number, ProblemRow>(repo_problems.selectProblemsByStatus(['active', 'resolved']).map((p) => [p.id, p]));
    const by_title = new Map<string, ProblemRow>([...live.values()].map((p) => [normTitle(p.title), p]));
    const touched = new Set<number>();
    const session_ms = Date.parse(session.occurred_at);

    /** One progress note on an existing problem, plus the forward-only date bump and any status change. */
    const note = (problem: ProblemRow, body: string, status?: 'active' | 'resolved'): void => {
        repo_updates.insertProblemUpdate({ problem_id: problem.id, session_id: session.id, body, source: 'ai', created_at: session.occurred_at });
        const forward = !problem.last_discussed_at || Date.parse(problem.last_discussed_at) < session_ms;
        const next_status = status && status !== problem.status ? status : undefined;
        const patch = { ...(forward ? { last_discussed_at: session.occurred_at } : {}), ...(next_status ? { status: next_status } : {}) };
        const updated = Object.keys(patch).length ? repo_problems.updateProblem(problem.id, patch) : problem;
        if (updated) live.set(problem.id, updated);
        touched.add(problem.id);
        if (next_status === 'resolved') result.resolved++;
    };

    for (const u of extraction.problem_updates) {
        const problem = live.get(u.problem_id);
        if (!problem || touched.has(problem.id) || !u.progress_note) {
            console.warn(`[sessions] session ${session.id}: skipped a problem update for problem_id=${u.problem_id} (${!problem ? 'no such open problem' : 'duplicate or empty'})`);
            result.skipped++;
            continue;
        }
        note(problem, u.progress_note, u.suggested_status);
        result.updated++;
    }

    for (const p of extraction.new_problems) {
        const same = by_title.get(normTitle(p.title));
        if (same) {
            if (touched.has(same.id) || !p.progress_note) {
                result.skipped++;
            } else {
                note(same, p.progress_note);
                result.updated++;
            }
            continue;
        }
        const created = repo_problems.insertProblem({ title: p.title, description: p.description, last_discussed_at: session.occurred_at, origin_session_id: session.id });
        live.set(created.id, created);
        by_title.set(normTitle(created.title), created);
        touched.add(created.id);
        repo_updates.insertProblemUpdate({ problem_id: created.id, session_id: session.id, body: p.progress_note || p.description, source: 'ai', created_at: session.occurred_at });
        result.created++;
    }
    return result;
};
