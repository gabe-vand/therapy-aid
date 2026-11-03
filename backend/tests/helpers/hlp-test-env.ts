// Preloaded by bunfig.toml before any test file imports app code. svc-db opens its database at
// import time, so the path must be set first: every test run gets a fresh in-memory SQLite.
// The AI / auth vars are blanked so a developer's shell env can never make a test hit the
// network, pick a different model, or lock the routes behind a login.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AI_TASKS } from '@therapy-aid/shared';

process.env.DB_PATH = ':memory:';
process.env.APP_REVISION = 'test';
process.env.APP_ENV = 'development';
// Snapshots from any test that uses the default dir land in a throwaway folder, never the repo.
process.env.BACKUP_DIR = mkdtempSync(join(tmpdir(), 'therapy-aid-backups-'));
process.env.RECORDINGS_DIR = mkdtempSync(join(tmpdir(), 'therapy-aid-recordings-'));
process.env.APP_TIMEZONE = 'UTC';

process.env.ANTHROPIC_API_KEY = '';
process.env.DEEPGRAM_API_KEY = '';
process.env.ALLOWED_TAILSCALE_LOGIN = '';
process.env.CLAUDE_MODEL = '';
for (const task of AI_TASKS) {
    process.env[`CLAUDE_MODEL_${task.toUpperCase()}`] = '';
    process.env[`CLAUDE_EFFORT_${task.toUpperCase()}`] = '';
}
