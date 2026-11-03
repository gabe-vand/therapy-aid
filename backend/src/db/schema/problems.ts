// Entity for db-schemas/003.problems.sql. The DDL file is the source of truth for the table's
// shape; this mirrors it for typed Drizzle queries.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const problems = sqliteTable('problems', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    status: text('status', { enum: ['active', 'resolved', 'discarded'] }).notNull(),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
    last_discussed_at: text('last_discussed_at'),
    last_reviewed_at: text('last_reviewed_at'),
    origin_session_id: integer('origin_session_id'),
});
