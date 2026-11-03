// One more query on problem_updates, kept apart from problem-updates.ts (file size): which
// problems each of a set of sessions wrote notes on — the dots of Home's thread grid.
import { inArray } from 'drizzle-orm';
import { problem_updates } from '@/db/schema/problem-updates';
import { db } from '@/services/common/svc-db';

/** Distinct (problem_id, session_id) pairs for the given sessions. [] for no sessions. */
export const selectProblemSessionPairs = (session_ids: number[]): { problem_id: number; session_id: number }[] => {
    if (session_ids.length === 0) return [];
    const rows = db.selectDistinct({ problem_id: problem_updates.problem_id, session_id: problem_updates.session_id }).from(problem_updates).where(inArray(problem_updates.session_id, session_ids)).all();
    return rows.filter((r): r is { problem_id: number; session_id: number } => r.session_id !== null);
};
