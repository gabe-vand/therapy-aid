// The Hono app and its mount table, separate from index.ts so tests can drive it with
// app.request() without binding a port. Routers mount at bare paths — the SPA's /api prefix is
// stripped by nginx (prod) and the Vite proxy (dev) before a request gets here.
// Everything except /health sits behind md-auth (the Tailscale login check).
import { Hono } from 'hono';
import { except } from 'hono/combine';
import { logger } from 'hono/logger';
import { router_ai } from '@/routes/ai/ai';
import { router_chat } from '@/routes/chat/chat';
import { router_focus } from '@/routes/focus/focus';
import { router_health } from '@/routes/health/health';
import { router_hello } from '@/routes/hello/hello';
import { router_journal } from '@/routes/journal/journal';
import { router_me } from '@/routes/me/me';
import { router_problems } from '@/routes/problems/problems';
import { router_sessions } from '@/routes/sessions/sessions';
import { router_settings } from '@/routes/settings/settings';
import { err, rsp, stc } from '@/services/common/svc-response';
import { md_auth } from '@/services/middleware/md-auth';

export const app = new Hono();

app.use(logger());

// /health stays public: compose healthchecks and scripts/deploy.sh poll it without a login.
app.use('*', except(['/health', '/health/*'], md_auth));

app.route('/health', router_health);
app.route('/hello', router_hello);
app.route('/me', router_me);
app.route('/ai', router_ai);
app.route('/settings', router_settings);
app.route('/sessions', router_sessions);
app.route('/problems', router_problems);
app.route('/focus', router_focus);
app.route('/journal', router_journal);
app.route('/chat', router_chat);

app.notFound((c) => rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND));

// Last-resort handler: log the real error, give the client nothing internal.
app.onError((e, c) => {
    console.error('[api] unhandled error', e);
    return rsp(c, {}, stc.SERVER_FAULT, err.SERVER_FAULT);
});
