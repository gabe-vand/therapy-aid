import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqlite } from '@/services/common/svc-db';
import { dbMigrate, splitStatements } from '@/services/common/svc-migrate';

// Guarded ALTERs: a schema file that appends `alter table … add column` must re-run cleanly on
// every boot (SQLite has no "if not exists" for columns).

describe('splitStatements', () => {
    it('drops comment lines and splits on semicolons', () => {
        expect(splitStatements('-- a comment; with a semicolon\ncreate table t (x);\n\nalter table t add column y text;\n')).toEqual(['create table t (x)', 'alter table t add column y text']);
    });
});

describe('dbMigrate with an add-column file', () => {
    it('applies the column once and treats the duplicate as already applied on the next run', () => {
        const dir = mkdtempSync(join(tmpdir(), 'ta-migrate-'));
        writeFileSync(join(dir, '001.t.sql'), 'create table if not exists migrate_probe (id integer primary key);\nalter table migrate_probe add column note text;\n');
        expect(dbMigrate(dir)).toEqual(['001.t.sql']);
        expect(dbMigrate(dir)).toEqual(['001.t.sql']);
        const columns = (sqlite.query('pragma table_info(migrate_probe)').all() as { name: string }[]).map((c) => c.name);
        expect(columns).toEqual(['id', 'note']);
        sqlite.exec('drop table migrate_probe');
    });

    it('still fails on any other error', () => {
        const dir = mkdtempSync(join(tmpdir(), 'ta-migrate-'));
        writeFileSync(join(dir, '001.bad.sql'), 'alter table no_such_table add column x text;\n');
        expect(() => dbMigrate(dir)).toThrow();
    });
});
