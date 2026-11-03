// The backend's one view of the environment. Every env read goes through app_env — never
// process.env.X elsewhere — so defaults and the mandatory list live in exactly one place.
// A new var lands in EnvKey + app_env + MANDATORY (if required) + .env.example in one commit.
import { AI_TASKS, type AiTask } from '@therapy-aid/shared';

interface EnvKey {
    app_env: string;
    // Git short SHA of the running build; /health echoes it so a deploy can prove it went live.
    revision: string;
    port: number;
    // SQLite file path, or ':memory:' (tests).
    db_path: string;
    // Where the daily snapshots go (services/backups) and how many of them are kept.
    backup_dir: string;
    backup_retention_days: number;
    // Claude. Optional at boot: without it every AI call fails with AiNotConfiguredError.
    anthropic_api_key: string;
    // Optional global model override for every task ('' = use the per-task table in svc-models).
    claude_model: string;
    // Per-task overrides from CLAUDE_MODEL_<TASK> / CLAUDE_EFFORT_<TASK> ('' = not set).
    claude_task_models: Record<AiTask, string>;
    claude_task_efforts: Record<AiTask, string>;
    // Deepgram (transcription). Optional: recordings fail cleanly until it is set.
    deepgram_api_key: string;
    // The one Tailscale login allowed in (md-auth). Empty: allow-all in development, deny-all otherwise.
    allowed_login: string;
    // Session recordings, one folder per session. On the Pi: /data/recordings (the db volume).
    recordings_dir: string;
    // IANA zone the context pack renders dates in, so "Sep 11" means Gabe's Sep 11, not UTC's.
    timezone: string;
}

/** CLAUDE_<KIND>_<TASK> for every task, '' where unset. */
const per_task = (kind: 'MODEL' | 'EFFORT'): Record<AiTask, string> =>
    Object.fromEntries(AI_TASKS.map((task) => [task, process.env[`CLAUDE_${kind}_${task.toUpperCase()}`] || ''])) as Record<AiTask, string>;

export const app_env: EnvKey = {
    app_env: process.env.APP_ENV || 'development',
    revision: process.env.APP_REVISION || 'dev',
    port: Number(process.env.PORT || 3010),
    db_path: process.env.DB_PATH || './data/therapy-aid.sqlite',
    backup_dir: process.env.BACKUP_DIR || './data/backups',
    backup_retention_days: Number(process.env.BACKUP_RETENTION_DAYS || 30),
    anthropic_api_key: process.env.ANTHROPIC_API_KEY || '',
    claude_model: process.env.CLAUDE_MODEL || '',
    claude_task_models: per_task('MODEL'),
    claude_task_efforts: per_task('EFFORT'),
    deepgram_api_key: process.env.DEEPGRAM_API_KEY || '',
    allowed_login: (process.env.ALLOWED_TAILSCALE_LOGIN || '').trim(),
    recordings_dir: process.env.RECORDINGS_DIR || './data/recordings',
    timezone: process.env.APP_TIMEZONE || 'America/Toronto',
};

/** Vars the API cannot boot without. Everything else has a safe default above. */
const MANDATORY: (keyof EnvKey)[] = ['db_path'];

/** Checked once at boot by index.ts, which exits on any missing mandatory var. */
export const getEnvStatus = (): { ok: boolean; missing: string[] } => {
    const missing = MANDATORY.filter((key) => !app_env[key]);
    return { ok: missing.length === 0, missing };
};
