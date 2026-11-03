// Business logic for the hello-world smoke test: the page that proves frontend → API → SQLite
// all work on the Pi. Throwaway once real features land, but it is the reference shape for one.
import type { HelloStatus } from '@therapy-aid/shared';
import * as repo_hello from '@/repositories/hello';
import { app_env } from '@/services/common/svc-env';

/** Current visit stats plus the build revision and SQLite version. */
export const getHelloStatus = (): HelloStatus => {
    const stats = repo_hello.selectVisitStats();
    return { message: 'Hello from therapy-aid', revision: app_env.revision, visit_count: stats.visit_count, first_visit_at: stats.first_visit_at, last_visit_at: stats.last_visit_at, sqlite_version: repo_hello.selectSqliteVersion() };
};

/** Writes one visit row, then returns the refreshed status so the SPA needs no second call. */
export const recordVisit = (): HelloStatus => {
    repo_hello.insertVisit();
    return getHelloStatus();
};
