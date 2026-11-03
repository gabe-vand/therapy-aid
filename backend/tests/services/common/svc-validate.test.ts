import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { validate } from '@/services/common/svc-validate';

const Body = z.object({ occurred_at: z.string(), notes: z.string().min(1, 'Write something first.') });

describe('validate', () => {
    it('returns the parsed data on success', () => {
        expect(validate(Body, { occurred_at: 'x', notes: 'y', extra: 1 })).toEqual({ ok: true, data: { occurred_at: 'x', notes: 'y' } });
    });

    it('names the first bad field in a readable message', () => {
        expect(validate(Body, { occurred_at: 'x', notes: '' })).toEqual({ ok: false, error: 'notes: Write something first.' });
    });

    it('handles a body that is not an object at all', () => {
        const result = validate(Body, null);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
    });
});
