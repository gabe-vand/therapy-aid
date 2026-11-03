// Entity for db-schemas/008.chat_threads.sql. The DDL file is the source of truth for the
// table's shape; this mirrors it for typed Drizzle queries.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const chat_threads = sqliteTable('chat_threads', { id: integer('id').primaryKey({ autoIncrement: true }), title: text('title').notNull(), created_at: text('created_at').notNull(), updated_at: text('updated_at').notNull() });
