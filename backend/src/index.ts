// API entry: validate env, apply the schema, then serve. Migration runs BEFORE the server binds
// (SQLite is local and fast), so no request can ever see a half-migrated database.
import { app } from '@/app';
import { app_env, getEnvStatus } from '@/services/common/svc-env';
import { dbMigrate } from '@/services/common/svc-migrate';

const env_status = getEnvStatus();
if (!env_status.ok) {
    console.error(`[boot] missing mandatory env vars: ${env_status.missing.join(', ')}`);
    process.exit(1);
}

const applied = dbMigrate();
console.log(`[boot] schema applied (${applied.length} files) to ${app_env.db_path}`);
console.log(`[boot] therapy-aid api ${app_env.revision} listening on :${app_env.port}`);

export default { port: app_env.port, fetch: app.fetch };
