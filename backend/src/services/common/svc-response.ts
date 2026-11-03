// The one way a route answers. Every handler responds through rsp() — never raw c.json — so the
// SPA always receives the same { data, status_code, message } envelope (ApiEnvelope in shared).
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export enum stc {
    OKAY = 200,
    VALIDATION = 400,
    UNAUTHORIZED = 401,
    ACCESS_DENIED = 403,
    NOT_FOUND = 404,
    SERVER_FAULT = 500,
}

export enum err {
    OKAY = 'OKAY',
    VALIDATION = 'VALIDATION',
    UNAUTHORIZED = 'UNAUTHORIZED',
    ACCESS_DENIED = 'ACCESS_DENIED',
    NOT_FOUND = 'ENTRY_NOT_FOUND',
    SERVER_FAULT = 'SERVER_FAULT',
}

/** Wraps data in the envelope and sets the real HTTP status, so proxies and logs see it too. */
export const rsp = <T>(c: Context, data: T, status_code: stc = stc.OKAY, message?: string | err) => {
    return c.json({ data, status_code, message: message || err.OKAY }, status_code as ContentfulStatusCode);
};
