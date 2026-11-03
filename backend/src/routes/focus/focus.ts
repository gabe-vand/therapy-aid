// /focus — the Home banner. GET reads the latest snapshot (null before the first one);
// POST /regenerate asks Claude for a fresh one. An AI failure answers 500 with the human-readable
// reason (not configured, declined, unusable reply) so the Refresh button can show it as is.
// Mounted at /focus in app.ts (behind md-auth).
import { Hono } from 'hono';
import { AiError } from '@/services/common/svc-claude';
import { rsp, stc } from '@/services/common/svc-response';
import { getLatestFocus, regenerateFocus } from '@/services/focus/focus';

export const router_focus = new Hono();

router_focus.get('/', (c) => rsp(c, getLatestFocus()));

router_focus.post('/regenerate', async (c) => {
    try {
        return rsp(c, await regenerateFocus());
    } catch (e) {
        console.error('[focus] regenerate failed', e);
        const message = e instanceof AiError ? e.message : 'The AI request failed. Try again in a minute.';
        return rsp(c, {}, stc.SERVER_FAULT, message);
    }
});
