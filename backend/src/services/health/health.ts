// Liveness for compose healthchecks and scripts/deploy.sh, which polls until `revision` matches
// the SHA it just shipped — proof the NEW container is the one answering, not the old one.
import type { HealthStatus } from '@therapy-aid/shared';
import * as repo_health from '@/repositories/health';
import { app_env } from '@/services/common/svc-env';

/** ok is the API answering at all; db_ok is SQLite answering too. */
export const getHealth = (): HealthStatus => {
    let db_ok = true;
    try {
        repo_health.selectOne();
    } catch (e) {
        console.error('[health] database probe failed', e);
        db_ok = false;
    }
    return { ok: true, revision: app_env.revision, db_ok };
};
