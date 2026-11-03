// Applies backend/db-schemas/*.sql in filename order on every boot. There is no applied-ledger:
// every file re-runs every time, so every statement must be idempotent (create table if not
// exists, …). One file per table — later changes to a table are appended under its own DDL.
// SQLite has no "add column if not exists", so an `alter table … add column` whose column is
// already there is the one error that is treated as "already applied" (statement by statement,
// inside the file's transaction); anything else still fails the boot.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sqlite } from './svc-db';

const SCHEMA_DIR = join(import.meta.dir, '..', '..', '..', 'db-schemas');

/** The statements of one DDL file: comment lines dropped, split on the `;` that ends each one. */
export const splitStatements = (ddl: string): string[] =>
    ddl
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

const isAddColumn = (statement: string): boolean => /^alter\s+table\s+\S+\s+add\s+column/i.test(statement);

/** Runs each schema file inside its own transaction; returns the file names applied. */
export const dbMigrate = (dir: string = SCHEMA_DIR): string[] => {
    const files = readdirSync(dir)
        .filter((name) => name.endsWith('.sql'))
        .sort();

    for (const name of files) {
        const ddl = readFileSync(join(dir, name), 'utf8');
        // A half-applied file would leave a table in a shape no file describes — all or nothing.
        sqlite.transaction(() => {
            for (const statement of splitStatements(ddl)) {
                try {
                    sqlite.exec(statement);
                } catch (e) {
                    if (isAddColumn(statement) && /duplicate column name/i.test(String(e))) continue;
                    throw e;
                }
            }
        })();
    }
    return files;
};
