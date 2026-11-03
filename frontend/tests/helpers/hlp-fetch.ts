import { vi } from 'vitest';

/* Fetch stubs for hook and page tests. Stub per test with stub_api / stub_unreachable;
   tests/setup.ts unstubs after each test. Routes are matched on "METHOD /api/path" (query string
   ignored) or plain "/api/path" (any method); a missing route answers 404 in the envelope. */

/* A Response carrying the { data, status_code, message } envelope. */
export const envelope = (data: unknown, status_code = 200, message?: string) =>
    new Response(JSON.stringify({ data, status_code, message: message ?? (status_code === 200 ? 'OKAY' : 'SERVER_FAULT') }), { status: status_code, headers: { 'content-type': 'application/json' } });

export type RouteReply = unknown | Response | ((init: RequestInit | undefined, url: string) => unknown | Response | Promise<unknown | Response>);

/* Stubs fetch with a route table. A plain value becomes a 200 envelope; return a Response (e.g.
   envelope(null, 400, 'notes: Write something first.')) for anything else. Returns the mock. */
export const stub_api = (routes: Record<string, RouteReply>) => {
    const mock = vi.fn(async (url: string, init?: RequestInit) => {
        const path = url.split('?')[0]!;
        const method = (init?.method ?? 'GET').toUpperCase();
        const key = `${method} ${path}` in routes ? `${method} ${path}` : path in routes ? path : null;
        if (key === null) return envelope(null, 404, 'ENTRY_NOT_FOUND');
        const route = routes[key];
        const reply = typeof route === 'function' ? await (route as (i: RequestInit | undefined, u: string) => unknown)(init, url) : route;
        return reply instanceof Response ? reply : envelope(reply);
    });
    vi.stubGlobal('fetch', mock);
    return mock;
};

/* Stubs fetch to fail as if the network were down. */
export const stub_unreachable = () =>
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );

/* The parsed JSON body of the n-th call to a fetch mock (for asserting what a hook sent). */
export const sent_body = (mock: ReturnType<typeof vi.fn>, n = 0): unknown => {
    const init = mock.mock.calls[n]?.[1] as RequestInit | undefined;
    return typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
};
