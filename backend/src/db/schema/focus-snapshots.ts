// Entities for db-schemas/005.focus_snapshots.sql and 013.focus_checkins.sql. The DDL files are
// the source of truth for the tables' shapes; these mirror them for typed Drizzle queries.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const focus_snapshots = sqliteTable('focus_snapshots', { id: integer('id').primaryKey({ autoIncrement: true }), session_id: integer('session_id'), content_json: text('content_json').notNull(), created_at: text('created_at').notNull() });

export const focus_checkins = sqliteTable('focus_checkins', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshot_id: integer('snapshot_id').notNull(),
    item_index: integer('item_index').notNull(),
    day: text('day').notNull(),
    created_at: text('created_at').notNull(),
});
