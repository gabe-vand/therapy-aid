// /journal — entry CRUD and the notes on an entry: GET /:id/insights lists both kinds, POST /:id/notes
// classifies one finished paragraph and may write a margin note, POST /:id/insights writes an
// on-demand reflection, POST /:id/insights/:note_id/dismiss hides one.
// Thin: validate the body with zod, call the service, answer through rsp().
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { AiError } from '@/services/common/svc-claude';
import { err, rsp, stc } from '@/services/common/svc-response';
import { validate } from '@/services/common/svc-validate';
import { createEntry, deleteEntry, dismissInsight, getEntry, listEntries, listInsights, updateEntry } from '@/services/journal/journal';
import { generateInsight } from '@/services/journal/insights';
import { noteParagraph } from '@/services/journal/margin/margin';

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
const MAX_PARAGRAPH = 4_000;
const NoteBody = z.object({ paragraph: z.string('Expected text.').trim().min(20, 'Too short to say anything about.').max(MAX_PARAGRAPH, 'Too long for one paragraph.'), write: z.boolean().default(true) });

const idOf = (c: Context): number | null => {
    const id = Number(c.req.param('id'));
    return Number.isInteger(id) && id > 0 ? id : null;
};

const notFound = (c: Context) => rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);
const aiFailure = (c: Context, where: string, e: unknown) => {
    // AiError messages are written to be shown; anything else is generic. The draft is never at risk: autosave owns it.
    console.error(`[journal] ${where} failed`, e);
    return rsp(c, {}, stc.SERVER_FAULT, e instanceof AiError ? e.message : 'The AI service had a problem. Your draft is saved. Try again in a moment.');
};

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
        return aiFailure(c, 'reflection', e);
    }
});

router_journal.post('/:id/notes', async (c) => {
    const id = idOf(c);
    if (!id) return notFound(c);
    const body = validate(NoteBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    try {
        const result = await noteParagraph(id, body.data.paragraph, body.data.write);
        return result ? rsp(c, result) : notFound(c);
    } catch (e) {
        return aiFailure(c, 'margin note', e);
    }
});

router_journal.post('/:id/insights/:note_id/dismiss', (c) => {
    const id = idOf(c);
    const note_id = Number(c.req.param('note_id'));
    if (!id || !Number.isInteger(note_id) || note_id <= 0) return notFound(c);
    const note = dismissInsight(id, note_id);
    return note ? rsp(c, note) : notFound(c);
});
