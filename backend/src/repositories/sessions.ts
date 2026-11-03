// Queries on sessions. One narrow function per query: params in, rows out, no business logic.
// FOUNDATION wrote the functions below; BE-SESSIONS may add more but does not change these.
import { and, asc, desc, eq, inArray, lt, ne } from 'drizzle-orm';
import type { SessionStatus } from '@therapy-aid/shared';
import { sessions } from '@/db/schema/sessions';
import { db } from '@/services/common/svc-db';

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = Omit<typeof sessions.$inferInsert, 'id' | 'created_at' | 'updated_at'>;
export type SessionPatch = Partial<NewSessionRow>;
export type SessionListRow = Pick<SessionRow, 'id' | 'occurred_at' | 'source' | 'status' | 'title' | 'created_at'>;
export type SessionSummaryRow = Pick<SessionRow, 'id' | 'occurred_at' | 'title' | 'summary_json'>;

const newest_first = [desc(sessions.occurred_at), desc(sessions.id)];

/** Inserts one session (timestamps set here) and returns the stored row. */
export const insertSession = (values: NewSessionRow): SessionRow => {
    const now = new Date().toISOString();
    return db
        .insert(sessions)
        .values({ ...values, created_at: now, updated_at: now })
        .returning()
        .get();
};

/** One session, or null. */
export const selectSessionById = (id: number): SessionRow | null => db.select().from(sessions).where(eq(sessions.id, id)).get() ?? null;

/** Every session's list columns, newest occurred_at first (ties: newest id first). */
export const selectSessionList = (): SessionListRow[] =>
    db
        .select({ id: sessions.id, occurred_at: sessions.occurred_at, source: sessions.source, status: sessions.status, title: sessions.title, created_at: sessions.created_at })
        .from(sessions)
        .orderBy(...newest_first)
        .all();

/** Every session, full rows, oldest first (search-index rebuild; small table). */
export const selectAllSessions = (): SessionRow[] => db.select().from(sessions).orderBy(asc(sessions.occurred_at), asc(sessions.id)).all();

/** Ready sessions' summaries, newest first; `limit` caps the count. Optional `before`
    (exclusive occurred_at) and `exclude_id` serve the summarizer ("the sessions before this one"). */
export const selectReadySessionSummaries = (opts: { limit?: number; before?: string; exclude_id?: number } = {}): SessionSummaryRow[] => {
    const where = and(
        eq(sessions.status, 'ready'),
        opts.before ? lt(sessions.occurred_at, opts.before) : undefined,
        opts.exclude_id !== undefined ? ne(sessions.id, opts.exclude_id) : undefined,
    );
    const query = db
        .select({ id: sessions.id, occurred_at: sessions.occurred_at, title: sessions.title, summary_json: sessions.summary_json })
        .from(sessions)
        .where(where)
        .orderBy(...newest_first);
    return opts.limit !== undefined ? query.limit(opts.limit).all() : query.all();
};

/** Sessions in any of `statuses`, oldest created first (boot recovery re-queues in order). */
export const selectSessionsByStatus = (statuses: SessionStatus[]): SessionRow[] =>
    db.select().from(sessions).where(inArray(sessions.status, statuses)).orderBy(asc(sessions.created_at), asc(sessions.id)).all();

/** Applies `patch` and bumps updated_at. Returns the updated row, or null if there is none. */
export const updateSession = (id: number, patch: SessionPatch): SessionRow | null =>
    db
        .update(sessions)
        .set({ ...patch, updated_at: new Date().toISOString() })
        .where(eq(sessions.id, id))
        .returning()
        .get() ?? null;

/** Deletes one session (problem_updates.session_id / problems.origin_session_id are nulled by FK). */
export const deleteSession = (id: number): void => {
    db.delete(sessions).where(eq(sessions.id, id)).run();
};
