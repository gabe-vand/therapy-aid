// Unauthenticated liveness endpoint. Reports only booleans and the revision — never paths,
// errors or config, since anyone on the tailnet can read it.
import { Hono } from 'hono';
import { rsp, stc } from '@/services/common/svc-response';
import { getHealth } from '@/services/health/health';

export const router_health = new Hono();

router_health.get('/', (c) => {
    const health = getHealth();
    return rsp(c, health, health.db_ok ? stc.OKAY : stc.SERVER_FAULT);
});
