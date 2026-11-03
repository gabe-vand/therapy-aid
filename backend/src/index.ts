// API entry: validate env, apply the schema, then serve. Migration runs BEFORE the server binds
// (SQLite is local and fast), so no request can ever see a half-migrated database. After it:
// refill the search index if it is empty (cheap insurance after a restore), then re-queue any
// session a restart interrupted mid-pipeline.
import { app } from '@/app';
import { startBackupSchedule } from '@/services/backups/schedule';
import { app_env, getEnvStatus } from '@/services/common/svc-env';
import { dbMigrate } from '@/services/common/svc-migrate';
import { describeRouting } from '@/services/common/svc-models';
import { logAuthMode } from '@/services/middleware/md-auth';
import { rebuildSearchIndexIfEmpty } from '@/services/search/search';
import { recoverStuckSessions } from '@/services/sessions/pipeline';

const env_status = getEnvStatus();
if (!env_status.ok) {
    console.error(`[boot] missing mandatory env vars: ${env_status.missing.join(', ')}`);
    process.exit(1);
}

const applied = dbMigrate();
console.log(`[boot] schema applied (${applied.length} files) to ${app_env.db_path}`);

const reindexed = rebuildSearchIndexIfEmpty();
if (reindexed !== null) console.log(`[boot] search index was empty — rebuilt ${reindexed} documents`);

recoverStuckSessions();

logAuthMode();
for (const line of describeRouting()) console.log(line);
if (!app_env.anthropic_api_key) console.warn('[ai] ANTHROPIC_API_KEY is unset — AI features will fail until it is set');
if (!app_env.deepgram_api_key) console.warn('[deepgram] DEEPGRAM_API_KEY is unset — recordings cannot be transcribed until it is set');

// Daily snapshots into app_env.backup_dir — first pass now, then hourly checks.
startBackupSchedule();
console.log(`[boot] therapy-aid api ${app_env.revision} listening on :${app_env.port}`);

export default { port: app_env.port, fetch: app.fetch };
