// Entity for db-schemas/005.focus_snapshots.sql. The DDL file is the source of truth for the
// table's shape; this mirrors it for typed Drizzle queries.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const focus_snapshots = sqliteTable('focus_snapshots', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    session_id: integer('session_id'),
    content_json: text('content_json').notNull(),
    created_at: text('created_at').notNull(),
});
