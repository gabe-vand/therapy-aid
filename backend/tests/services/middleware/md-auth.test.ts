import { afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { ApiEnvelope, Me } from '@therapy-aid/shared';
import { app } from '@/app';
import { app_env } from '@/services/common/svc-env';
import { dbMigrate } from '@/services/common/svc-migrate';
import { DEV_LOGIN, LOGIN_HEADER, authMode, logAuthMode } from '@/services/middleware/md-auth';

// md-auth through the real app: the header check, dev mode, the fail-closed default, and
// /health staying public in every mode.

const get = async (path: string, login?: string) => {
    const res = await app.request(path, { headers: login ? { [LOGIN_HEADER]: login } : {} });
    return { status: res.status, body: (await res.json()) as ApiEnvelope<Me> };
};

beforeAll(() => dbMigrate());
beforeEach(() => {
    spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    app_env.allowed_login = '';
    app_env.app_env = 'development';
    (console.warn as unknown as { mockRestore: () => void }).mockRestore();
});

describe('with ALLOWED_TAILSCALE_LOGIN set', () => {
    beforeEach(() => {
        app_env.allowed_login = 'gabe@example.com';
        app_env.app_env = 'production';
    });

    it('lets the matching login in and exposes it on /me', async () => {
        const { status, body } = await get('/me', 'gabe@example.com');
        expect(status).toBe(200);
        expect(body.data.login).toBe('gabe@example.com');
    });

    it('compares case-insensitively', async () => {
        expect((await get('/me', 'Gabe@Example.com')).status).toBe(200);
    });

    it('rejects a different login, and a missing header, with 401 in the envelope', async () => {
        for (const login of ['someone@else.com', undefined]) {
            const { status, body } = await get('/me', login);
            expect(status).toBe(401);
            expect(body.message).toBe('UNAUTHORIZED');
        }
    });

    it('guards every router, not just /me', async () => {
        for (const path of ['/settings/profile', '/ai/usage', '/sessions', '/hello', '/nope']) expect((await get(path)).status).toBe(401);
    });

    it('keeps /health public', async () => {
        expect((await get('/health')).status).toBe(200);
    });
});

describe('with ALLOWED_TAILSCALE_LOGIN unset', () => {
    it('allows everything as dev@local in development', async () => {
        expect(authMode()).toBe('dev');
        const { status, body } = await get('/me');
        expect(status).toBe(200);
        expect(body.data.login).toBe(DEV_LOGIN);
    });

    it('rejects everything in any other environment — fails closed — but /health still answers', async () => {
        app_env.app_env = 'production';
        expect(authMode()).toBe('locked');
        expect((await get('/me', 'gabe@example.com')).status).toBe(401);
        expect((await get('/health')).status).toBe(200);
    });

    it('logs the locked state loudly at boot', () => {
        app_env.app_env = 'production';
        const error = spyOn(console, 'error').mockImplementation(() => {});
        logAuthMode();
        expect(error).toHaveBeenCalledWith('[auth] ALLOWED_TAILSCALE_LOGIN is unset — all requests rejected');
        error.mockRestore();
    });
});
