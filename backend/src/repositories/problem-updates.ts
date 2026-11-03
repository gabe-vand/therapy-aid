// Queries on problem_updates (progress notes). One narrow function per query.
// FOUNDATION wrote the functions below; BE-PROBLEMS-FOCUS may add more but does not change these.
import { count, desc, eq, max, sql } from 'drizzle-orm';
import { problem_updates } from '@/db/schema/problem-updates';
import { problems } from '@/db/schema/problems';
import { sessions } from '@/db/schema/sessions';
import { db } from '@/services/common/svc-db';

export type ProblemUpdateRow = typeof problem_updates.$inferSelect;
export type NewProblemUpdateRow = Pick<ProblemUpdateRow, 'problem_id' | 'body' | 'source'> & { session_id?: number | null };
export type ProblemUpdateWithSession = ProblemUpdateRow & { session_title: string | null };
export type SessionUpdateRow = { problem_id: number; problem_title: string; body: string; origin_session_id: number | null; created_at: string };

/** Inserts one progress note and returns it. `created_at` may be passed (e.g. the session's
    occurred_at when seeding history) — otherwise now. */
export const insertProblemUpdate = (values: NewProblemUpdateRow & { created_at?: string }): ProblemUpdateRow =>
    db
        .insert(problem_updates)
        .values({ session_id: null, ...values, created_at: values.created_at ?? new Date().toISOString() })
        .returning()
        .get();

/** A problem's notes, newest first, each with its session's title; `limit` caps the count. */
export const selectUpdatesForProblem = (problem_id: number, limit?: number): ProblemUpdateWithSession[] => {
    const query = db
        .select({
            id: problem_updates.id,
            problem_id: problem_updates.problem_id,
            session_id: problem_updates.session_id,
            body: problem_updates.body,
            source: problem_updates.source,
            created_at: problem_updates.created_at,
            session_title: sessions.title,
        })
        .from(problem_updates)
        .leftJoin(sessions, eq(sessions.id, problem_updates.session_id))
        .where(eq(problem_updates.problem_id, problem_id))
        .orderBy(desc(problem_updates.created_at), desc(problem_updates.id));
    return limit !== undefined ? query.limit(limit).all() : query.all();
};

/** What one session did to problems: each note with its problem's title and origin (so the
    caller can tell "opened a new problem" from "updated an existing one"), oldest first. */
export const selectUpdatesForSession = (session_id: number): SessionUpdateRow[] =>
    db
        .select({ problem_id: problem_updates.problem_id, problem_title: problems.title, body: problem_updates.body, origin_session_id: problems.origin_session_id, created_at: problem_updates.created_at })
        .from(problem_updates)
        .innerJoin(problems, eq(problems.id, problem_updates.problem_id))
        .where(eq(problem_updates.session_id, session_id))
        .orderBy(problem_updates.id)
        .all();

/** Per problem: how many notes it has and when the newest was written. */
export const selectUpdateStats = (): { problem_id: number; update_count: number; latest_at: string | null }[] =>
    db
        .select({ problem_id: problem_updates.problem_id, update_count: count(), latest_at: max(problem_updates.created_at) })
        .from(problem_updates)
        .groupBy(problem_updates.problem_id)
        .all();

/** Deletes every note a session wrote (re-processing a session replaces its notes). */
export const deleteUpdatesForSession = (session_id: number): void => {
    db.delete(problem_updates).where(eq(problem_updates.session_id, session_id)).run();
};

/** Per problem: the body of its newest note (same ordering as selectUpdatesForProblem). */
export const selectLatestUpdateBodies = (): { problem_id: number; body: string }[] =>
    db
        .select({ problem_id: problem_updates.problem_id, body: problem_updates.body })
        .from(problem_updates)
        .where(sql`${problem_updates.id} = (select u.id from problem_updates u where u.problem_id = ${problem_updates.problem_id} order by u.created_at desc, u.id desc limit 1)`)
        .all();
