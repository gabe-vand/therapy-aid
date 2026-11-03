// /dashboard — the numbers Home draws (sessions rhythm, thread grid, journal stats). Read-only,
// computed from rows on every call. Mounted at /dashboard in app.ts (behind md-auth).
import { Hono } from 'hono';
import { rsp } from '@/services/common/svc-response';
import { buildDashboard } from '@/services/dashboard/dashboard';

export const router_dashboard = new Hono();

router_dashboard.get('/', (c) => rsp(c, buildDashboard()));
