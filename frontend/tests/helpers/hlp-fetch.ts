import { vi } from 'vitest';
import type { HelloStatus } from '@therapy-aid/shared';

/* A HelloStatus with overridable fields — the shape GET /hello and POST /hello/visits return. */
export const hello_status = (over: Partial<HelloStatus> = {}): HelloStatus => ({
    message: 'Hello from therapy-aid',
    revision: 'abc1234',
    visit_count: 3,
    first_visit_at: '2026-11-01T10:00:00.000Z',
    last_visit_at: '2026-11-02T10:00:00.000Z',
    sqlite_version: '3.50.0',
    ...over,
});

const envelope = (data: unknown, status_code = 200) =>
    new Response(JSON.stringify({ data, status_code, message: status_code === 200 ? 'OKAY' : 'SERVER_FAULT' }), {
        status: status_code,
        headers: { 'content-type': 'application/json' },
    });

/* Stubs fetch: GET answers `get`, POST answers `post`. Returns the mock for call assertions. */
export const stub_hello_api = (get: HelloStatus, post?: HelloStatus) => {
    const mock = vi.fn(async (_url: string, init?: RequestInit) => envelope(init?.method === 'POST' ? (post ?? get) : get));
    vi.stubGlobal('fetch', mock);
    return mock;
};

/* Stubs fetch to fail as if the network were down. */
export const stub_unreachable = () => vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
