// Entity for db-schemas/010.app_settings.sql. The DDL file is the source of truth for the
// table's shape; this mirrors it for typed Drizzle queries. (011.search_index is an FTS5
// virtual table — raw SQL only, in repositories/search.ts.)
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const app_settings = sqliteTable('app_settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    updated_at: text('updated_at').notNull(),
});
