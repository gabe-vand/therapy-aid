// The backend's one view of the environment. Every env read goes through app_env — never
// process.env.X elsewhere — so defaults and the mandatory list live in exactly one place.
// A new var lands in EnvKey + app_env + MANDATORY (if required) + .env.example in one commit.
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
}

export const app_env: EnvKey = {
    app_env: process.env.APP_ENV || 'development',
    revision: process.env.APP_REVISION || 'dev',
    port: Number(process.env.PORT || 3010),
    db_path: process.env.DB_PATH || './data/therapy-aid.sqlite',
    backup_dir: process.env.BACKUP_DIR || './data/backups',
    backup_retention_days: Number(process.env.BACKUP_RETENTION_DAYS || 30),
};

/** Vars the API cannot boot without. Everything else has a safe default above. */
const MANDATORY: (keyof EnvKey)[] = ['db_path'];

/** Checked once at boot by index.ts, which exits on any missing mandatory var. */
export const getEnvStatus = (): { ok: boolean; missing: string[] } => {
    const missing = MANDATORY.filter((key) => !app_env[key]);
    return { ok: missing.length === 0, missing };
};
