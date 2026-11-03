// Entity for db-schemas/007.journal_insights.sql. The DDL file is the source of truth for the
// table's shape; this mirrors it for typed Drizzle queries.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const journal_insights = sqliteTable('journal_insights', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entry_id: integer('entry_id').notNull(),
    body: text('body').notNull(),
    created_at: text('created_at').notNull(),
});
