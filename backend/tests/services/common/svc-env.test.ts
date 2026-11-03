import { describe, expect, it } from 'bun:test';
import { app_env, getEnvStatus, isValidTimeZone } from '@/services/common/svc-env';

// Boot-time env validation: mandatory vars, and an APP_TIMEZONE typo caught at boot instead of on
// the first AI call.

describe('getEnvStatus', () => {
    it('is ok with the test environment', () => {
        expect(getEnvStatus()).toEqual({ ok: true, missing: [], invalid: [] });
    });

    it('reports a missing mandatory var', () => {
        const status = getEnvStatus({ ...app_env, db_path: '' });
        expect(status.ok).toBe(false);
        expect(status.missing).toEqual(['db_path']);
    });

    it('rejects an APP_TIMEZONE that is not an IANA zone', () => {
        const status = getEnvStatus({ ...app_env, timezone: 'America/NewYork' });
        expect(status.ok).toBe(false);
        expect(status.invalid[0]).toContain('America/NewYork');
    });
});

describe('isValidTimeZone', () => {
    it('accepts real zones and UTC, rejects typos', () => {
        expect(isValidTimeZone('America/New_York')).toBe(true);
        expect(isValidTimeZone('UTC')).toBe(true);
        expect(isValidTimeZone('America/NewYork')).toBe(false);
        expect(isValidTimeZone('')).toBe(false);
    });
});
