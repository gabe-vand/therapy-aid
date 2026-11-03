// /journal — entry CRUD and the on-demand "I have an idea…" insights (SPEC §6).
// Thin: validate the body with zod, call the service, answer through rsp().
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { AiError } from '@/services/common/svc-claude';
import { err, rsp, stc } from '@/services/common/svc-response';
import { validate } from '@/services/common/svc-validate';
import { createEntry, deleteEntry, getEntry, listEntries, listInsights, updateEntry } from '@/services/journal/journal';
import { generateInsight } from '@/services/journal/insights';

export const router_journal = new Hono();

// Anything an editor could plausibly hold; far below what would hurt the context pack or the db.
const MAX_BODY = 200_000;
const OccurredAt = z
    .string('Expected a date.')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Not a valid date.')
    .transform((value) => new Date(value).toISOString());
const Body = z.string('Expected text.').max(MAX_BODY, 'Too long.');

const CreateBody = z.object({ occurred_at: OccurredAt.optional(), body: Body });
const PatchBody = z.object({ occurred_at: OccurredAt.optional(), body: Body.optional() });
const InsightBody = z.object({ body: Body.refine((value) => value.trim().length > 0, 'Write something first.') });

const idOf = (c: Context): number | null => {
    const id = Number(c.req.param('id'));
    return Number.isInteger(id) && id > 0 ? id : null;
};

const notFound = (c: Context) => rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);

router_journal.get('/', (c) => rsp(c, listEntries()));

router_journal.post('/', async (c) => {
    const body = validate(CreateBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    return rsp(c, createEntry(body.data));
});

router_journal.get('/:id', (c) => {
    const id = idOf(c);
    const entry = id ? getEntry(id) : null;
    return entry ? rsp(c, entry) : notFound(c);
});

router_journal.patch('/:id', async (c) => {
    const id = idOf(c);
    if (!id) return notFound(c);
    const body = validate(PatchBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    const entry = updateEntry(id, body.data);
    return entry ? rsp(c, entry) : notFound(c);
});

router_journal.delete('/:id', (c) => {
    const id = idOf(c);
    return id && deleteEntry(id) ? rsp(c, { id }) : notFound(c);
});

router_journal.get('/:id/insights', (c) => {
    const id = idOf(c);
    const insights = id ? listInsights(id) : null;
    return insights ? rsp(c, insights) : notFound(c);
});

router_journal.post('/:id/insights', async (c) => {
    const id = idOf(c);
    if (!id) return notFound(c);
    const body = validate(InsightBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    try {
        const insight = await generateInsight(id, body.data.body);
        return insight ? rsp(c, insight) : notFound(c);
    } catch (e) {
        // The draft is already saved. AiError messages are written to be shown; anything else is generic.
        console.error('[journal] insight failed', e);
        return rsp(c, {}, stc.SERVER_FAULT, e instanceof AiError ? e.message : 'The AI service had a problem. Your draft is saved. Try again in a moment.');
    }
});
