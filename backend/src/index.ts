// API entry: validate env, apply the schema, then serve. Migration runs BEFORE the server binds
// (SQLite is local and fast), so no request can ever see a half-migrated database. After it:
// refill the search index if it is empty (cheap insurance after a restore), re-queue any session a
// restart interrupted mid-pipeline, and keep sweeping abandoned recordings on a timer.
// In development the API binds to 127.0.0.1 only: dev auth lets every request in as dev@local, so
// listening on every interface would serve a dev database to the whole LAN. The container
// (APP_ENV=production) must listen on all interfaces for nginx to reach it.
import { app } from '@/app';
import { startBackupSchedule } from '@/services/backups/schedule';
import { app_env, getEnvStatus } from '@/services/common/svc-env';
import { dbMigrate } from '@/services/common/svc-migrate';
import { describeRouting } from '@/services/common/svc-models';
import { logAuthMode } from '@/services/middleware/md-auth';
import { rebuildSearchIndexIfEmpty } from '@/services/search/search';
import { recoverStuckSessions, startRecordingSweep } from '@/services/sessions/recovery';

const env_status = getEnvStatus();
if (!env_status.ok) {
    if (env_status.missing.length) console.error(`[boot] missing mandatory env vars: ${env_status.missing.join(', ')}`);
    if (env_status.invalid.length) console.error(`[boot] invalid env vars: ${env_status.invalid.join(', ')}`);
    process.exit(1);
}

const applied = dbMigrate();
console.log(`[boot] schema applied (${applied.length} files) to ${app_env.db_path}`);

const reindexed = rebuildSearchIndexIfEmpty();
if (reindexed !== null) console.log(`[boot] search index was empty — rebuilt ${reindexed} documents`);

recoverStuckSessions();
startRecordingSweep();

logAuthMode();
for (const line of describeRouting()) console.log(line);
if (!app_env.anthropic_api_key) console.warn('[ai] ANTHROPIC_API_KEY is unset — AI features will fail until it is set');
if (!app_env.deepgram_api_key) console.warn('[deepgram] DEEPGRAM_API_KEY is unset — recordings cannot be transcribed until it is set');

// Daily snapshots into app_env.backup_dir — first pass now, then hourly checks.
startBackupSchedule();
const hostname = app_env.app_env === 'development' ? '127.0.0.1' : '0.0.0.0';
console.log(`[boot] therapy-aid api ${app_env.revision} listening on ${hostname}:${app_env.port}`);

export default { hostname, port: app_env.port, fetch: app.fetch };
