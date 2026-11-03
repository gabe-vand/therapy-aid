// Entity for db-schemas/001.visits.sql. The DDL file is the source of truth for the table's
// shape; this mirrors it for typed Drizzle queries.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const visits = sqliteTable('visits', { id: integer('id').primaryKey({ autoIncrement: true }), created_at: text('created_at').notNull() });
