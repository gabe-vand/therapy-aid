// Entity for db-schemas/002.sessions.sql. The DDL file is the source of truth for the table's
// shape; this mirrors it for typed Drizzle queries.
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    occurred_at: text('occurred_at').notNull(),
    source: text('source', { enum: ['recording', 'notes'] }).notNull(),
    status: text('status', { enum: ['recording', 'uploaded', 'transcribing', 'summarizing', 'ready', 'failed'] }).notNull(),
    title: text('title'),
    notes: text('notes'),
    transcript: text('transcript'),
    summary_json: text('summary_json'),
    error: text('error'),
    audio_path: text('audio_path'),
    audio_mime: text('audio_mime'),
    duration_sec: real('duration_sec'),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
});
