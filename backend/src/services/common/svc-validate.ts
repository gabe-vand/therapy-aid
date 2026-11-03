// Request validation with zod, shared by every router so a 400 always reads the same way:
// "<field>: <what is wrong>". Routers parse the body, call validate(), and answer
// rsp(c, {}, stc.VALIDATION, result.error) on failure. Pure — no Hono here.
import type { z } from 'zod';

export type Validated<T> = { ok: true; data: T } | { ok: false; error: string };

/** Checks `value` against `schema`; on failure, a readable message naming the first bad field. */
export const validate = <T>(schema: z.ZodType<T>, value: unknown): Validated<T> => {
    const result = schema.safeParse(value);
    if (result.success) return { ok: true, data: result.data };
    const issue = result.error.issues[0];
    const field = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    return { ok: false, error: `${field}${issue?.message ?? 'Invalid request.'}` };
};
