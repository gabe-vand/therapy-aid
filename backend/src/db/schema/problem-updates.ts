// Entity for db-schemas/004.problem_updates.sql. The DDL file is the source of truth for the
// table's shape; this mirrors it for typed Drizzle queries.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const problem_updates = sqliteTable('problem_updates', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    problem_id: integer('problem_id').notNull(),
    session_id: integer('session_id'),
    body: text('body').notNull(),
    source: text('source', { enum: ['ai', 'manual'] }).notNull(),
    created_at: text('created_at').notNull(),
});
