// Preloaded by bunfig.toml before any test file imports app code. svc-db opens its database at
// import time, so the path must be set first: every test run gets a fresh in-memory SQLite.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DB_PATH = ':memory:';
process.env.APP_REVISION = 'test';
// Snapshots from any test that uses the default dir land in a throwaway folder, never the repo.
process.env.BACKUP_DIR = mkdtempSync(join(tmpdir(), 'therapy-aid-backups-'));
