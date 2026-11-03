// Snapshot queries for the daily backup (services/backups).
import { Database } from 'bun:sqlite';
import { sqlite } from '@/services/common/svc-db';

/** Writes a consistent, compacted copy of the live database to `path` (which must not exist).
    VACUUM INTO runs while the app stays online and includes whatever is still in the WAL. */
export const vacuumInto = (path: string): void => {
    sqlite.query('vacuum into ?').run(path);
};

/** Opens a snapshot read-only and runs SQLite's full integrity check; true only on "ok". */
export const integrityCheck = (path: string): boolean => {
    const snapshot = new Database(path, { readonly: true });
    try {
        const row = snapshot.query('pragma integrity_check').get() as { integrity_check: string };
        return row.integrity_check === 'ok';
    } finally {
        snapshot.close();
    }
};
