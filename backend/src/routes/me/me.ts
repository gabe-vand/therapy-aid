// GET /me — who md-auth let in. The SPA shows it on Settings; it is also the cheapest way to
// check from a browser that the Tailscale header is reaching the API.
import { Hono } from 'hono';
import type { Me } from '@therapy-aid/shared';
import { rsp } from '@/services/common/svc-response';

export const router_me = new Hono();

router_me.get('/', (c) => rsp<Me>(c, { login: c.get('login') }));
