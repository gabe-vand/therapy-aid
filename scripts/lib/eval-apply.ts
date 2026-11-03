// applyProblemUpdates (backend/src/services/sessions/apply-problems.ts) over the eval's in-memory
// world, so each model's problem list evolves session by session exactly as the app's would: an
// invented id is skipped, a "new" problem whose title matches an existing one becomes an update,
// last_discussed_at only moves forward, a resolved suggestion is honoured. Pure apart from `world`.
import type { ProblemRow } from '../../backend/src/repositories/problems';
import type { ApplyResult } from '../../backend/src/services/sessions/apply-problems';
import type { ProblemExtraction } from '../../backend/src/services/sessions/prompts-map';
import { problemsByStatus, type EvalSession, type World } from './eval-world';

const normTitle = (title: string): string =>
    title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

/** Applies one session's extraction to `world` and reports what it did. */
export const applyExtraction = (world: World, session: EvalSession, extraction: ProblemExtraction): ApplyResult => {
    world.updates = world.updates.filter((u) => u.session_id !== session.id);
    const result: ApplyResult = { updated: 0, created: 0, resolved: 0, skipped: 0 };
    const live = new Map<number, ProblemRow>(problemsByStatus(world, ['active', 'resolved']).map((p) => [p.id, p]));
    const by_title = new Map<string, ProblemRow>([...live.values()].map((p) => [normTitle(p.title), p]));
    const touched = new Set<number>();
    const session_ms = Date.parse(session.occurred_at);

    const addUpdate = (problem_id: number, body: string): void => {
        const id = world.updates.reduce((max, u) => Math.max(max, u.id), 0) + 1;
        world.updates.push({ id, problem_id, session_id: session.id, body, source: 'ai', created_at: session.occurred_at, session_title: session.title });
    };

    const note = (problem: ProblemRow, body: string, status?: 'active' | 'resolved'): void => {
        addUpdate(problem.id, body);
        if (!problem.last_discussed_at || Date.parse(problem.last_discussed_at) < session_ms) problem.last_discussed_at = session.occurred_at;
        if (status && status !== problem.status) {
            problem.status = status;
            if (status === 'resolved') result.resolved++;
        }
        touched.add(problem.id);
    };

    for (const u of extraction.problem_updates) {
        const problem = live.get(u.problem_id);
        if (!problem || touched.has(problem.id) || !u.progress_note) {
            result.skipped++;
            continue;
        }
        note(problem, u.progress_note, u.suggested_status);
        result.updated++;
    }

    for (const p of extraction.new_problems) {
        const same = by_title.get(normTitle(p.title));
        if (same) {
            if (touched.has(same.id) || !p.progress_note) result.skipped++;
            else {
                note(same, p.progress_note);
                result.updated++;
            }
            continue;
        }
        const id = world.problems.reduce((max, row) => Math.max(max, row.id), 0) + 1;
        const created: ProblemRow = {
            id,
            title: p.title,
            description: p.description,
            status: 'active',
            created_at: session.occurred_at,
            updated_at: session.occurred_at,
            last_discussed_at: session.occurred_at,
            last_reviewed_at: null,
            origin_session_id: session.id,
        };
        world.problems.push(created);
        live.set(id, created);
        by_title.set(normTitle(created.title), created);
        touched.add(id);
        addUpdate(id, p.progress_note || p.description);
        result.created++;
    }
    return result;
};
