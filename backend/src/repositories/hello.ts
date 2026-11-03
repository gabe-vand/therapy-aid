// Queries behind the hello-world smoke test. Repositories are the only place a query may live:
// one narrow function per query, params in, rows out, no business logic.
import { count, max, min } from 'drizzle-orm';
import { visits } from '@/db/schema/visits';
import { db, sqlite } from '@/services/common/svc-db';

/** Records one visit, timestamped in UTC ISO-8601 so text ordering is time ordering. */
export const insertVisit = (): void => {
    db.insert(visits).values({ created_at: new Date().toISOString() }).run();
};

/** Total visits plus the first and latest timestamps (both null on an empty table). */
export const selectVisitStats = (): { visit_count: number; first_visit_at: string | null; last_visit_at: string | null } => {
    const row = db
        .select({ visit_count: count(), first_visit_at: min(visits.created_at), last_visit_at: max(visits.created_at) })
        .from(visits)
        .get();
    return row ?? { visit_count: 0, first_visit_at: null, last_visit_at: null };
};

/** The SQLite library version Bun is linked against — shown on the hello page as proof of life. */
export const selectSqliteVersion = (): string => {
    const row = sqlite.query('select sqlite_version() as version').get() as { version: string };
    return row.version;
};
