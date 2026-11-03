// /sessions — list, read, notes intake, edit, retry, delete. The recording intake routes live in
// recordings.ts and are composed in below. Thin: validate, call the service, answer via rsp().
import { Hono } from 'hono';
import { z } from 'zod';
import { err, rsp, stc } from '@/services/common/svc-response';
import { validate } from '@/services/common/svc-validate';
import { createFromNotes } from '@/services/sessions/notes';
import { retrySession } from '@/services/sessions/pipeline';
import { getSession, listSessions, patchSession, removeSession, toSession } from '@/services/sessions/sessions';
import { answer, IsoTimestamp, parseId } from './http';
import { router_recordings } from './recordings';

export const router_sessions = new Hono();
router_sessions.route('/', router_recordings);

const NotesBody = z.object({
    occurred_at: IsoTimestamp.optional(),
    notes: z.string('Expected the notes as text.').trim().min(1, 'The notes are empty.').max(500_000, 'The notes are too long (500,000 characters max).'),
    title: z.string().trim().max(200, 'The title is too long (200 characters max).').nullish(),
});
const PatchBody = z
    .object({ occurred_at: IsoTimestamp.optional(), title: z.string('Expected text.').max(200, 'The title is too long (200 characters max).').nullable().optional() })
    .refine((b) => b.occurred_at !== undefined || b.title !== undefined, 'Nothing to change: send occurred_at and/or title.');

router_sessions.get('/', (c) => rsp(c, listSessions()));

router_sessions.post('/notes', async (c) => {
    const body = validate(NotesBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    const { occurred_at, notes, title } = body.data;
    return answer(c, () => toSession(createFromNotes({ occurred_at: occurred_at ?? new Date().toISOString(), notes, title })));
});

router_sessions.get('/:id', (c) => {
    const id = parseId(c.req.param('id'));
    if (id === null) return rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);
    return answer(c, () => getSession(id));
});

router_sessions.patch('/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (id === null) return rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);
    const body = validate(PatchBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    return answer(c, () => patchSession(id, body.data));
});

router_sessions.post('/:id/retry', (c) => {
    const id = parseId(c.req.param('id'));
    if (id === null) return rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);
    return answer(c, () => toSession(retrySession(id)));
});

router_sessions.delete('/:id', (c) => {
    const id = parseId(c.req.param('id'));
    if (id === null) return rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);
    return answer(c, () => {
        removeSession(id);
        return { id };
    });
});
