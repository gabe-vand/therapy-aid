// Shared plumbing for the sessions routers: path-id parsing and the one place a typed service
// error becomes an HTTP status. Services throw (they never see Hono); routes answer via rsp().
import type { Context } from 'hono';
import { z } from 'zod';
import { err, rsp, stc } from '@/services/common/svc-response';
import { ChunkCountError, ChunkOrderError, SessionInputError, SessionNotFoundError, SessionStateError } from '@/services/sessions/errors';

/** A positive integer from a path segment, or null. */
export const parseId = (raw: string | undefined): number | null => (raw && /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);

/** A timestamp string zod accepts only if Date can read it, normalised to ISO-8601 UTC. */
export const IsoTimestamp = z
    .string('Expected a date.')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Expected a valid date.')
    .transform((s) => new Date(s).toISOString());

/** Maps a service error to its response; anything unrecognised is rethrown (app.onError logs it). */
export const sessionErrorResponse = (c: Context, e: unknown) => {
    if (e instanceof SessionNotFoundError) return rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);
    if (e instanceof ChunkOrderError) return rsp(c, { expected: e.expected }, stc.CONFLICT, err.CONFLICT);
    if (e instanceof ChunkCountError) return rsp(c, { received: e.received }, stc.CONFLICT, e.message);
    if (e instanceof SessionStateError) return rsp(c, {}, stc.CONFLICT, e.message);
    if (e instanceof SessionInputError) return rsp(c, {}, stc.VALIDATION, e.message);
    throw e;
};

/** Runs `fn`, answers its result in the envelope, and turns typed service errors into statuses. */
export const answer = async (c: Context, fn: () => unknown): Promise<Response> => {
    try {
        return rsp(c, await fn());
    } catch (e) {
        return sessionErrorResponse(c, e);
    }
};
