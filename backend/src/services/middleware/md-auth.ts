// Who may use the API. The app is tailnet-only: `tailscale serve` adds Tailscale-User-Login to
// every request it proxies from the tailnet (Funnel is off, so nothing reaches us without it).
// We allow a request iff that header is the one configured login. With no login configured,
// development allows everything as dev@local and every other environment rejects everything —
// a misconfigured Pi fails closed, never open. Applied in app.ts to everything but /health.
import { createMiddleware } from 'hono/factory';
import { app_env } from '@/services/common/svc-env';
import { err, rsp, stc } from '@/services/common/svc-response';

export const LOGIN_HEADER = 'Tailscale-User-Login';
export const DEV_LOGIN = 'dev@local';

type AuthMode = 'login' | 'dev' | 'locked';

/** How requests are being authorised right now (read per request so tests can flip app_env). */
export const authMode = (): AuthMode => {
    if (app_env.allowed_login) return 'login';
    return app_env.app_env === 'development' ? 'dev' : 'locked';
};

/** The one boot log line about auth — the misconfiguration case is loud. */
export const logAuthMode = (): void => {
    const mode = authMode();
    if (mode === 'locked') console.error('[auth] ALLOWED_TAILSCALE_LOGIN is unset — all requests rejected');
    else if (mode === 'dev') console.log(`[auth] development mode — every request is ${DEV_LOGIN}`);
    else console.log(`[auth] allowing ${app_env.allowed_login}`);
};

/** Sets c.get('login') on success; answers 401 in the envelope otherwise. Logins compare
    case-insensitively (Tailscale logins are emails or user@github). */
export const md_auth = createMiddleware(async (c, next) => {
    const mode = authMode();
    if (mode === 'dev') {
        c.set('login', DEV_LOGIN);
        return next();
    }
    const login = (c.req.header(LOGIN_HEADER) ?? '').trim();
    if (mode === 'login' && login && login.toLowerCase() === app_env.allowed_login.toLowerCase()) {
        c.set('login', login);
        return next();
    }
    console.warn(`[auth] rejected ${c.req.method} ${c.req.path} (login: ${login || 'none'})`);
    return rsp(c, {}, stc.UNAUTHORIZED, err.UNAUTHORIZED);
});
