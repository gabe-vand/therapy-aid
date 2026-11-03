// Queries on problems. One narrow function per query: params in, rows out, no business logic.
// FOUNDATION wrote the functions below; BE-PROBLEMS-FOCUS may add more but does not change these.
import { asc, eq, inArray } from 'drizzle-orm';
import type { ProblemStatus } from '@therapy-aid/shared';
import { problems } from '@/db/schema/problems';
import { db } from '@/services/common/svc-db';

export type ProblemRow = typeof problems.$inferSelect;
export type NewProblemRow = Pick<ProblemRow, 'title' | 'description'> & Partial<Pick<ProblemRow, 'status' | 'last_discussed_at' | 'last_reviewed_at' | 'origin_session_id'>>;
export type ProblemPatch = Partial<Omit<ProblemRow, 'id' | 'created_at' | 'updated_at'>>;

/** Inserts one problem (status defaults to active; timestamps set here) and returns it. */
export const insertProblem = (values: NewProblemRow): ProblemRow => {
    const now = new Date().toISOString();
    return db
        .insert(problems)
        .values({ status: 'active', ...values, created_at: now, updated_at: now })
        .returning()
        .get();
};

/** One problem, or null. */
export const selectProblemById = (id: number): ProblemRow | null => db.select().from(problems).where(eq(problems.id, id)).get() ?? null;

/** Problems in any of `statuses`, by id (creation order) — callers sort for display. */
export const selectProblemsByStatus = (statuses: ProblemStatus[]): ProblemRow[] =>
    db.select().from(problems).where(inArray(problems.status, statuses)).orderBy(asc(problems.id)).all();

/** Applies `patch` and bumps updated_at. Returns the updated row, or null if there is none. */
export const updateProblem = (id: number, patch: ProblemPatch): ProblemRow | null =>
    db
        .update(problems)
        .set({ ...patch, updated_at: new Date().toISOString() })
        .where(eq(problems.id, id))
        .returning()
        .get() ?? null;
