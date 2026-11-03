// GET/PUT /settings/profile — the "About me" text every prompt includes.
import { Hono } from 'hono';
import { z } from 'zod';
import { rsp, stc } from '@/services/common/svc-response';
import { validate } from '@/services/common/svc-validate';
import { getProfile, putProfile } from '@/services/settings/settings';

export const router_settings = new Hono();

// 50k characters is far more than a profile needs, and far less than would blow the context budget.
const ProfileBody = z.object({ profile: z.string('Expected text.').max(50_000, 'Too long (50,000 characters max).') });

router_settings.get('/profile', (c) => rsp(c, getProfile()));

router_settings.put('/profile', async (c) => {
    const body = validate(ProfileBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    return rsp(c, putProfile(body.data.profile));
});
