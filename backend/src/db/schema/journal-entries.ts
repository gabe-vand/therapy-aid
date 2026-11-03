// Entity for db-schemas/006.journal_entries.sql. The DDL file is the source of truth for the
// table's shape; this mirrors it for typed Drizzle queries.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const journal_entries = sqliteTable('journal_entries', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    occurred_at: text('occurred_at').notNull(),
    body: text('body').notNull(),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
});
