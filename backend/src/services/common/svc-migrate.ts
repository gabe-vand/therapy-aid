// Applies backend/db-schemas/*.sql in filename order on every boot. There is no applied-ledger:
// every file re-runs every time, so every statement must be idempotent (create table if not
// exists, …). One file per table — later changes to a table are appended under its own DDL.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sqlite } from './svc-db';

const SCHEMA_DIR = join(import.meta.dir, '..', '..', '..', 'db-schemas');

/** Runs each schema file inside its own transaction; returns the file names applied. */
export const dbMigrate = (dir: string = SCHEMA_DIR): string[] => {
    const files = readdirSync(dir)
        .filter((name) => name.endsWith('.sql'))
        .sort();

    for (const name of files) {
        const ddl = readFileSync(join(dir, name), 'utf8');
        // A half-applied file would leave a table in a shape no file describes — all or nothing.
        sqlite.transaction(() => sqlite.exec(ddl))();
    }
    return files;
};
