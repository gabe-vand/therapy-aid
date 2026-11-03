// CSRF guard. Auth is the Tailscale identity header, which `tailscale serve` adds to EVERY request
// from the owner's browser — whichever web page made it. A cross-site page can still send a
// "simple" POST (text/plain body, no preflight), and the routes' c.req.json() never checks the
// Content-Type, so without this any page the owner visits could create notes, burn AI spend or
// write the journal. The SPA is same-origin, so a state-changing request is let through only when
// the browser says it came from this origin:
//   - Sec-Fetch-Site (every current browser) must be `same-origin` or `none` (typed/bookmarked);
//   - without it (an old browser), an Origin header must name this host;
//   - with neither, it is not a browser page (the import CLI, curl), so CSRF does not apply.
// GET/HEAD/OPTIONS never change anything and pass. Applied in app.ts ahead of md-auth.
import { createMiddleware } from 'hono/factory';
import { err, rsp, stc } from '@/services/common/svc-response';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SAME_SITE_VALUES = new Set(['same-origin', 'none']);

/** True when a host-bearing Origin header names the host this request was addressed to. */
const originMatches = (origin: string, host: string | undefined): boolean => {
    try {
        return !!host && new URL(origin).host.toLowerCase() === host.toLowerCase();
    } catch {
        return false;
    }
};

export const md_same_origin = createMiddleware(async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    const site = c.req.header('Sec-Fetch-Site');
    const origin = c.req.header('Origin');
    const host = c.req.header('X-Forwarded-Host') ?? c.req.header('Host');
    const allowed = site ? SAME_SITE_VALUES.has(site.toLowerCase()) : origin ? originMatches(origin, host) : true;
    if (allowed) return next();
    console.warn(`[auth] rejected cross-site ${c.req.method} ${c.req.path} (sec-fetch-site: ${site ?? 'none'}, origin: ${origin ?? 'none'})`);
    return rsp(c, {}, stc.ACCESS_DENIED, err.ACCESS_DENIED);
});
