import { afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { app } from '@/app';
import { dbMigrate } from '@/services/common/svc-migrate';
import { resetDatabase } from '../../helpers/hlp-db';

// md-same-origin through the real app: a cross-site "simple" POST (text/plain, no preflight) is
// refused before it reaches a handler, while the SPA's own requests, non-browser clients and reads
// pass. POST /journal is the probe — a successful one creates an entry.

const post = (headers: Record<string, string>) => app.request('/journal', { method: 'POST', headers: { 'Content-Type': 'text/plain', Host: 'therapy-aid.example.ts.net', ...headers }, body: JSON.stringify({ body: 'injected' }) });

let warn: { mockRestore: () => void };
beforeAll(() => dbMigrate());
beforeEach(() => {
    resetDatabase();
    warn = spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('md_same_origin', () => {
    it('refuses a cross-site POST with 403, before the handler runs', async () => {
        const res = await post({ 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' });
        expect(res.status).toBe(403);
        expect(((await res.json()) as { message: string }).message).toBe('ACCESS_DENIED');
        expect((await (await app.request('/journal')).json()) as { data: unknown[] }).toMatchObject({ data: [] });
    });

    it('refuses same-site (another tailnet host) too', async () => {
        expect((await post({ 'Sec-Fetch-Site': 'same-site' })).status).toBe(403);
    });

    it('lets the SPA’s own same-origin requests through', async () => {
        expect((await post({ 'Sec-Fetch-Site': 'same-origin', Origin: 'https://therapy-aid.example.ts.net' })).status).toBe(200);
    });

    it('without Sec-Fetch-Site, falls back to comparing Origin with the host', async () => {
        expect((await post({ Origin: 'https://evil.example' })).status).toBe(403);
        expect((await post({ Origin: 'https://therapy-aid.example.ts.net' })).status).toBe(200);
        expect((await post({ Origin: 'null' })).status).toBe(403);
    });

    it('lets a non-browser client (no Sec-Fetch-Site, no Origin) through — the import CLI', async () => {
        expect((await post({})).status).toBe(200);
    });

    it('never blocks a read, even cross-site', async () => {
        expect((await app.request('/journal', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(200);
    });
});
