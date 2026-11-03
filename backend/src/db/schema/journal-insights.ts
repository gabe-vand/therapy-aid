// Entities for db-schemas/007.journal_insights.sql and 012.journal_problem_links.sql. The DDL
// files are the source of truth for the tables' shapes; these mirror them for typed Drizzle queries.
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const journal_insights = sqliteTable('journal_insights', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entry_id: integer('entry_id').notNull(),
    body: text('body').notNull(),
    created_at: text('created_at').notNull(),
    kind: text('kind', { enum: ['connection', 'advice', 'question', 'reflection'] }).notNull(),
    source: text('source', { enum: ['margin', 'reflection'] }).notNull(),
    problem_id: integer('problem_id'),
    session_id: integer('session_id'),
    anchor: text('anchor'),
    dismissed_at: text('dismissed_at'),
});

export const journal_problem_links = sqliteTable('journal_problem_links', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entry_id: integer('entry_id').notNull(),
    problem_id: integer('problem_id').notNull(),
    confidence: real('confidence').notNull(),
    excerpt: text('excerpt').notNull(),
    created_at: text('created_at').notNull(),
});
