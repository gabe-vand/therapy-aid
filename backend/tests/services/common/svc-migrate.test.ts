import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
            const creates = ddl.match(/create\s+(table|index|unique\s+index)\s+(?!if\s+not\s+exists)/g);
            expect(creates, `${name} has a non-idempotent create`).toBeNull();
        }
    });
});
