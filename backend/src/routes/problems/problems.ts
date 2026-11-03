// /problems — the persistent threads. Thin: parse + validate, call the problems service, wrap in
// the envelope. Every mutation answers with the fresh ProblemDetail. Mounted at /problems (md-auth).
import { Hono } from 'hono';
import { z } from 'zod';
import { err, rsp, stc } from '@/services/common/svc-response';
import { validate } from '@/services/common/svc-validate';
import { addManualUpdate, createProblem, getProblem, keepProblem, listProblems, patchProblem } from '@/services/problems/problems';

export const router_problems = new Hono();

const text = (field: string, max: number) => z.string(`${field} must be text.`).trim().min(1, `${field} can't be empty.`).max(max, `${field} is too long (${max} characters max).`);

const CreateBody = z.object({ title: text('Title', 200), description: z.string('Description must be text.').trim().max(5_000, 'Description is too long (5,000 characters max).').default('') });
const PatchBody = z.object({
    title: text('Title', 200).optional(),
    description: z.string('Description must be text.').trim().max(5_000, 'Description is too long (5,000 characters max).').optional(),
    status: z.enum(['active', 'resolved', 'discarded'], 'Status must be active, resolved or discarded.').optional(),
});
const UpdateBody = z.object({ body: text('Note', 5_000) });

/** :id → a positive integer, or null (answered as 404 — an unreadable id can't exist). */
const idParam = (raw: string): number | null => (/^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);
const missing = (c: Parameters<typeof rsp>[0]) => rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);

router_problems.get('/', (c) => rsp(c, listProblems({ include_discarded: c.req.query('all') === '1' })));

router_problems.post('/', async (c) => {
    const body = validate(CreateBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    return rsp(c, createProblem(body.data));
});

router_problems.get('/:id', (c) => {
    const id = idParam(c.req.param('id'));
    const problem = id ? getProblem(id) : null;
    return problem ? rsp(c, problem) : missing(c);
});

router_problems.patch('/:id', async (c) => {
    const id = idParam(c.req.param('id'));
    const body = validate(PatchBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    const problem = id ? patchProblem(id, body.data) : null;
    return problem ? rsp(c, problem) : missing(c);
});

router_problems.post('/:id/updates', async (c) => {
    const id = idParam(c.req.param('id'));
    const body = validate(UpdateBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    const problem = id ? addManualUpdate(id, body.data.body) : null;
    return problem ? rsp(c, problem) : missing(c);
});

router_problems.post('/:id/keep', (c) => {
    const id = idParam(c.req.param('id'));
    const problem = id ? keepProblem(id) : null;
    return problem ? rsp(c, problem) : missing(c);
});
