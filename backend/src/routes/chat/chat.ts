// /chat — threads and the one-turn-at-a-time conversation (SPEC §6). Mounted at /chat, so the
// paths here start at /threads. Thin: validate, call the service, answer through rsp().
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { createThread, deleteThread, getThread, listThreads, sendMessage } from '@/services/chat/chat';
import { AiError } from '@/services/common/svc-claude';
import { err, rsp, stc } from '@/services/common/svc-response';
import { validate } from '@/services/common/svc-validate';

export const router_chat = new Hono();

const MessageBody = z.object({ content: z.string('Expected text.').max(20_000, 'Too long (20,000 characters max).').refine((value) => value.trim().length > 0, 'Write a message first.') });

const idOf = (c: Context): number | null => {
    const id = Number(c.req.param('id'));
    return Number.isInteger(id) && id > 0 ? id : null;
};

const notFound = (c: Context) => rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);

router_chat.get('/threads', (c) => rsp(c, listThreads()));

router_chat.post('/threads', (c) => rsp(c, createThread()));

router_chat.get('/threads/:id', (c) => {
    const id = idOf(c);
    const found = id ? getThread(id) : null;
    return found ? rsp(c, found) : notFound(c);
});

router_chat.delete('/threads/:id', (c) => {
    const id = idOf(c);
    return id && deleteThread(id) ? rsp(c, { id }) : notFound(c);
});

router_chat.post('/threads/:id/messages', async (c) => {
    const id = idOf(c);
    if (!id) return notFound(c);
    const body = validate(MessageBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    try {
        const exchange = await sendMessage(id, body.data.content);
        return exchange ? rsp(c, exchange) : notFound(c);
    } catch (e) {
        // Nothing was stored, so the client can simply resend. AiError messages are written to be shown.
        console.error('[chat] turn failed', e);
        return rsp(c, {}, stc.SERVER_FAULT, e instanceof AiError ? e.message : 'The AI service had a problem. Try again in a moment.');
    }
});
