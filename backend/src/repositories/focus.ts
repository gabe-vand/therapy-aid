// Queries on focus_snapshots. Append-only: the newest row is the current focus.
// FOUNDATION wrote the functions below; BE-PROBLEMS-FOCUS may add more but does not change these.
import { desc } from 'drizzle-orm';
import { focus_snapshots } from '@/db/schema/focus-snapshots';
import { db } from '@/services/common/svc-db';

export type FocusSnapshotRow = typeof focus_snapshots.$inferSelect;

/** Appends one snapshot (content_json = JSON of { headline, items }) and returns it. */
export const insertFocusSnapshot = (values: { session_id: number | null; content_json: string }): FocusSnapshotRow =>
    db
        .insert(focus_snapshots)
        .values({ ...values, created_at: new Date().toISOString() })
        .returning()
        .get();

/** The current focus (newest snapshot), or null before the first one. */
export const selectLatestFocusSnapshot = (): FocusSnapshotRow | null =>
    db.select().from(focus_snapshots).orderBy(desc(focus_snapshots.created_at), desc(focus_snapshots.id)).limit(1).get() ?? null;
