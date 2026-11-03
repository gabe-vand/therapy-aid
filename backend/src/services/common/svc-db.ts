// The SQLite connection — one file, one process, opened once at import. Bun ships the driver
// (bun:sqlite), so there is no native module to build on the Pi. Drizzle wraps the same handle;
// `sqlite` stays exported for the DDL runner and the odd raw query a repository needs.
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { app_env } from './svc-env';

/** Opens (creating if needed) the database file and applies per-connection pragmas. */
const open = (path: string): Database => {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    const handle = new Database(path, { create: true });

    // WAL: readers don't block the writer. busy_timeout: a locked write waits instead of failing.
    handle.exec('PRAGMA journal_mode = WAL;');
    handle.exec('PRAGMA busy_timeout = 5000;');
    handle.exec('PRAGMA foreign_keys = ON;');
    return handle;
};

export const sqlite = open(app_env.db_path);
export const db = drizzle({ client: sqlite });
