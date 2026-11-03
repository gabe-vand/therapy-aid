// Liveness probe query for /health.
import { sqlite } from '@/services/common/svc-db';

/** Throws if the database handle can no longer answer a trivial query. */
export const selectOne = (): void => {
    sqlite.query('select 1').get();
};
