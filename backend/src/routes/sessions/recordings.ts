// The recording intake routes, composed into router_sessions: start a recording, stream audio
// chunks in strict order, finalise (which starts transcription). Mounted under /sessions.
// The mime is anchored and length-capped: it is stored and later sent to Deepgram as Content-Type.
// chunk_count is optional on finalize — omitted, the server takes the chunks on disk (the salvage
// path for a recording whose browser died).
import { Hono } from 'hono';
import { z } from 'zod';
import { err, rsp, stc } from '@/services/common/svc-response';
import { validate } from '@/services/common/svc-validate';
import { appendChunk, createRecording, finalizeRecording } from '@/services/sessions/recordings';
import { toSession } from '@/services/sessions/sessions';
import { answer, IsoTimestamp, parseId } from './http';

export const router_recordings = new Hono();

const MIME = /^(audio|video)\/[\w.+-]+(\s*;[^\r\n;]+)*$/;
const StartBody = z.object({ occurred_at: IsoTimestamp.optional(), mime: z.string('Expected the recording mime type.').max(100, 'Expected an audio mime type, e.g. audio/webm.').regex(MIME, 'Expected an audio mime type, e.g. audio/webm.') });
const FinalizeBody = z.object({ chunk_count: z.number('Expected the number of chunks sent.').int('Expected a whole number.').min(1, 'At least one chunk is needed.').optional() });

router_recordings.post('/recordings', async (c) => {
    const body = validate(StartBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    return answer(c, () => ({ id: createRecording(body.data).id }));
});

router_recordings.post('/:id/chunks', async (c) => {
    const id = parseId(c.req.param('id'));
    if (id === null) return rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);
    const raw_seq = c.req.query('seq');
    const seq = raw_seq !== undefined && /^\d+$/.test(raw_seq) ? Number(raw_seq) : null;
    if (seq === null) return rsp(c, {}, stc.VALIDATION, 'seq: Expected a whole number from 0 up.');
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    return answer(c, () => ({ expected: appendChunk(id, seq, bytes) }));
});

router_recordings.post('/:id/finalize', async (c) => {
    const id = parseId(c.req.param('id'));
    if (id === null) return rsp(c, {}, stc.NOT_FOUND, err.NOT_FOUND);
    const body = validate(FinalizeBody, await c.req.json().catch(() => null));
    if (!body.ok) return rsp(c, {}, stc.VALIDATION, body.error);
    return answer(c, () => toSession(finalizeRecording(id, body.data.chunk_count)));
});
