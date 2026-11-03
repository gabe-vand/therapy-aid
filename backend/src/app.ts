// The Hono app and its mount table, separate from index.ts so tests can drive it with
// app.request() without binding a port. Routers mount at bare paths — the SPA's /api prefix is
// stripped by nginx (prod) and the Vite proxy (dev) before a request gets here.
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { router_health } from '@/routes/health/health';
import { router_hello } from '@/routes/hello/hello';
import { err, rsp, stc } from '@/services/common/svc-response';

export const app = new Hono();

app.use(logger());

app.route('/health', router_health);
app.route('/hello', router_hello);

app.notFound((c) => rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND));

// Last-resort handler: log the real error, give the client nothing internal.
app.onError((e, c) => {
    console.error('[api] unhandled error', e);
    return rsp(c, {}, stc.SERVER_FAULT, err.SERVER_FAULT);
});
