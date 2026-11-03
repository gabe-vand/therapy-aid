import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sqlite } from '@/services/common/svc-db';
import { dbMigrate } from '@/services/common/svc-migrate';

const SCHEMA_DIR = join(import.meta.dir, '..', '..', '..', 'db-schemas');
const schema_files = readdirSync(SCHEMA_DIR).filter((name) => name.endsWith('.sql'));

describe('dbMigrate', () => {
    it('is idempotent — every file re-runs on every boot', () => {
        expect(dbMigrate()).toEqual(dbMigrate());
    });

    it('applies files in filename order', () => {
        expect(dbMigrate()).toEqual([...schema_files].sort());
    });
});

describe('db-schemas', () => {
    it('are numbered NNN.<table>.sql', () => {
        for (const name of schema_files) expect(name).toMatch(/^\d{3}\.[a-z0-9_]+\.sql$/);
    });

    it('create every table with "if not exists"', () => {
        for (const name of schema_files) {
            const ddl = readFileSync(join(SCHEMA_DIR, name), 'utf8').toLowerCase();
            const creates = ddl.match(/create\s+(table|virtual\s+table|index|unique\s+index)\s+(?!if\s+not\s+exists)/g);
            expect(creates, `${name} has a non-idempotent create`).toBeNull();
        }
    });

    it('create every table the app reads, including the FTS5 search index', () => {
        dbMigrate();
        const tables = (sqlite.query("select name from sqlite_master where type = 'table'").all() as { name: string }[]).map((r) => r.name);
        for (const table of ['sessions', 'problems', 'problem_updates', 'focus_snapshots', 'journal_entries', 'journal_insights', 'chat_threads', 'chat_messages', 'app_settings', 'search_index']) {
            expect(tables).toContain(table);
        }
    });
});
