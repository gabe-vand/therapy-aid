// /focus — the Home banner. GET reads the latest snapshot (null before the first one);
// POST /regenerate asks Claude for a fresh one. An AI failure answers 500 with the human-readable
// reason (not configured, declined, unusable reply) so the Refresh button can show it as is.
// Mounted at /focus in app.ts (behind md-auth).
import { Hono } from 'hono';
import { z } from 'zod';
import { AiError } from '@/services/common/svc-claude';
import { err, rsp, stc } from '@/services/common/svc-response';
import { validate } from '@/services/common/svc-validate';
import { getLatestFocus, regenerateFocus, setCheckin } from '@/services/focus/focus';

export const router_focus = new Hono();

const CheckinBody = z.object({ item_index: z.number('Expected an item index.').int().min(0), day: z.string('Expected a day.').regex(/^\d{4}-\d{2}-\d{2}$/, 'Day must be YYYY-MM-DD.'), done: z.boolean('Expected done to be true or false.') });

router_focus.get('/', (c) => rsp(c, getLatestFocus()));

router_focus.put('/checkins', async (c) => {
    const body = validate(CheckinBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    const focus = setCheckin(body.data);
    return focus ? rsp(c, focus) : rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);
});

router_focus.post('/regenerate', async (c) => {
    try {
        return rsp(c, await regenerateFocus());
    } catch (e) {
        console.error('[focus] regenerate failed', e);
        const message = e instanceof AiError ? e.message : 'The AI request failed. Try again in a minute.';
        return rsp(c, {}, stc.SERVER_FAULT, message);
    }
});
