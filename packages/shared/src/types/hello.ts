/** GET /hello — the smoke-test payload proving API + database are both alive. */
export interface HelloStatus {
    message: string;
    revision: string;
    visit_count: number;
    first_visit_at: string | null;
    last_visit_at: string | null;
    sqlite_version: string;
}

/** GET /health — liveness for compose healthchecks and the deploy script. */
export interface HealthStatus {
    ok: boolean;
    revision: string;
    db_ok: boolean;
    // A verified snapshot from today or yesterday exists (services/backups).
    backup_ok: boolean;
}
