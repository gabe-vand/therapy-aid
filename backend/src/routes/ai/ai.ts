// GET /ai/usage — per-task model routing and estimated spend since boot (svc-claude-usage).
// This is how the owner sees what the AI costs; the Settings page renders it.
import { Hono } from 'hono';
import { getAiUsage } from '@/services/common/svc-claude-usage';
import { rsp } from '@/services/common/svc-response';

export const router_ai = new Hono();

router_ai.get('/usage', (c) => rsp(c, getAiUsage()));
