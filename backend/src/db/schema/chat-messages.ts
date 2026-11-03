// Entity for db-schemas/009.chat_messages.sql. The DDL file is the source of truth for the
// table's shape; this mirrors it for typed Drizzle queries.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const chat_messages = sqliteTable('chat_messages', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    thread_id: integer('thread_id').notNull(),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    created_at: text('created_at').notNull(),
});
