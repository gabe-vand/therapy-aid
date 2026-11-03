import { beforeAll, describe, expect, it } from 'bun:test';
import type { ApiEnvelope, HealthStatus, HelloStatus } from '@therapy-aid/shared';
import { app } from '@/app';
import { dbMigrate } from '@/services/common/svc-migrate';

// End-to-end through the real router, service, repository and an in-memory SQLite — the same
// path the Pi serves, minus the port.

const call = async <T>(method: string, path: string): Promise<{ status: number; body: ApiEnvelope<T> }> => {
    const res = await app.request(path, { method });
    return { status: res.status, body: (await res.json()) as ApiEnvelope<T> };
};

beforeAll(() => {
    dbMigrate();
});

describe('GET /health', () => {
    it('reports ok, the db, and the running revision', async () => {
        const { status, body } = await call<HealthStatus>('GET', '/health');
        expect(status).toBe(200);
        expect(body.data).toMatchObject({ ok: true, revision: 'test', db_ok: true });
        expect(typeof body.data.backup_ok).toBe('boolean');
    });
});

describe('hello', () => {
    it('GET /hello returns the greeting and the sqlite version', async () => {
        const { status, body } = await call<HelloStatus>('GET', '/hello');
        expect(status).toBe(200);
        expect(body.message).toBe('OKAY');
        expect(body.data.message).toBe('Hello from therapy-aid');
        expect(body.data.sqlite_version).toMatch(/^\d+\.\d+/);
    });

    it('POST /hello/visits persists a row and returns the new count', async () => {
        const before = (await call<HelloStatus>('GET', '/hello')).body.data.visit_count;
        const { body } = await call<HelloStatus>('POST', '/hello/visits');
        expect(body.data.visit_count).toBe(before + 1);
        expect(body.data.last_visit_at).not.toBeNull();
        expect((await call<HelloStatus>('GET', '/hello')).body.data.visit_count).toBe(before + 1);
    });
});

describe('unknown routes', () => {
    it('answer 404 inside the envelope', async () => {
        const { status, body } = await call('GET', '/nope');
        expect(status).toBe(404);
        expect(body.message).toBe('ENTRY_NOT_FOUND');
    });
});
