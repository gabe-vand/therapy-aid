// Stub — replaced by BE-SESSIONS; see SPEC §6
// Mounted at /sessions in app.ts (behind md-auth) so the mount table is final before the module lands.
import { Hono } from 'hono';

export const router_sessions = new Hono();
