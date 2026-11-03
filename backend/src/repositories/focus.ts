// Queries on focus_snapshots (append-only: the newest row is the current focus) and on
// focus_checkins, the per-day ticks against a snapshot's items.
import { and, desc, eq } from 'drizzle-orm';
import { focus_checkins, focus_snapshots } from '@/db/schema/focus-snapshots';
import { db } from '@/services/common/svc-db';

export type FocusSnapshotRow = typeof focus_snapshots.$inferSelect;
export type FocusCheckinRow = typeof focus_checkins.$inferSelect;

/** Appends one snapshot (content_json = JSON of { headline, items }) and returns it. */
export const insertFocusSnapshot = (values: { session_id: number | null; content_json: string }): FocusSnapshotRow =>
    db
        .insert(focus_snapshots)
        .values({ ...values, created_at: new Date().toISOString() })
        .returning()
        .get();

/** The current focus (newest snapshot), or null before the first one. */
export const selectLatestFocusSnapshot = (): FocusSnapshotRow | null => db.select().from(focus_snapshots).orderBy(desc(focus_snapshots.created_at), desc(focus_snapshots.id)).limit(1).get() ?? null;

/** A snapshot's check-ins, oldest day first. */
export const selectCheckins = (snapshot_id: number): FocusCheckinRow[] => db.select().from(focus_checkins).where(eq(focus_checkins.snapshot_id, snapshot_id)).orderBy(focus_checkins.day, focus_checkins.item_index).all();

/** Adds one check-in; a duplicate (same snapshot, item, day) is ignored. */
export const insertCheckin = (values: { snapshot_id: number; item_index: number; day: string }): void => {
    db.insert(focus_checkins)
        .values({ ...values, created_at: new Date().toISOString() })
        .onConflictDoNothing()
        .run();
};

/** Removes one check-in, if present. */
export const deleteCheckin = (values: { snapshot_id: number; item_index: number; day: string }): void => {
    db.delete(focus_checkins)
        .where(and(eq(focus_checkins.snapshot_id, values.snapshot_id), eq(focus_checkins.item_index, values.item_index), eq(focus_checkins.day, values.day)))
        .run();
};
