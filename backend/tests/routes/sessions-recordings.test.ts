import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import type { ApiEnvelope, Session } from '@therapy-aid/shared';
import { app } from '@/app';
import * as repo_sessions from '@/repositories/sessions';
import * as svc_deepgram from '@/services/common/svc-deepgram';
import { audioFile, recordingDir } from '@/services/sessions/audio-files';
import { pipelineIdle } from '@/services/sessions/pipeline';
import { resetDatabase } from '../helpers/hlp-db';
import { clearRecordings, stubClaude, stubFocus, SUMMARY } from '../services/sessions/fixtures';

// The recording intake over HTTP, start to finish: start, chunks (ordering + 409 { expected }),
// finalize (verification), then the pipeline to ready with Deepgram stubbed; and delete cleanup.

const json = async <T>(res: Response): Promise<{ status: number; body: ApiEnvelope<T> }> => ({ status: res.status, body: (await res.json()) as ApiEnvelope<T> });
const post = (path: string, body?: unknown) => app.request(path, { method: 'POST', body: JSON.stringify(body ?? {}), headers: { 'Content-Type': 'application/json' } });
const chunk = (id: number, seq: string | number, data: string) => app.request(`/sessions/${id}/chunks?seq=${seq}`, { method: 'POST', body: new TextEncoder().encode(data), headers: { 'Content-Type': 'audio/webm' } });

let spies: { mockRestore: () => void }[] = [];
beforeEach(() => {
    resetDatabase();
    clearRecordings();
    spies = [stubClaude(), stubFocus(), spyOn(console, 'log').mockImplementation(() => {}), spyOn(console, 'error').mockImplementation(() => {})];
});
afterEach(async () => {
    await pipelineIdle();
    for (const s of spies) s.mockRestore();
});

const start = async (mime = 'audio/webm;codecs=opus') => (await json<{ id: number }>(await post('/sessions/recordings', { mime }))).body.data!.id;

describe('POST /sessions/recordings', () => {
    it('starts a recording and answers its id', async () => {
        const { status, body } = await json<{ id: number }>(await post('/sessions/recordings', { mime: 'audio/mp4', occurred_at: '2026-09-11T16:00:00.000Z' }));
        expect(status).toBe(200);
        const row = repo_sessions.selectSessionById(body.data!.id)!;
        expect(row).toMatchObject({ source: 'recording', status: 'recording', audio_mime: 'audio/mp4', occurred_at: '2026-09-11T16:00:00.000Z' });
    });

    it('rejects a missing or non-audio mime', async () => {
        expect((await post('/sessions/recordings', {})).status).toBe(400);
        expect((await post('/sessions/recordings', { mime: 'text/plain' })).status).toBe(400);
    });
});

describe('POST /sessions/:id/chunks', () => {
    it('accepts chunks in order, answering the next expected seq', async () => {
        const id = await start();
        const first = await json<{ expected: number }>(await chunk(id, 0, 'AAA'));
        const second = await json<{ expected: number }>(await chunk(id, 1, 'BB'));
        expect(first.body.data).toEqual({ expected: 1 });
        expect(second.body.data).toEqual({ expected: 2 });
        expect(readFileSync(audioFile(repo_sessions.selectSessionById(id)!), 'utf8')).toBe('AAABB');
    });

    it('answers 409 CONFLICT with { expected } for an out-of-order chunk and writes nothing', async () => {
        const id = await start();
        await chunk(id, 0, 'AAA');
        const { status, body } = await json<{ expected: number }>(await chunk(id, 3, 'XXX'));
        expect(status).toBe(409);
        expect(body.message).toBe('CONFLICT');
        expect(body.data).toEqual({ expected: 1 });
        expect(readFileSync(audioFile(repo_sessions.selectSessionById(id)!), 'utf8')).toBe('AAA');
    });

    it('rejects a missing or malformed seq, an empty body, an unknown session', async () => {
        const id = await start();
        expect((await app.request(`/sessions/${id}/chunks`, { method: 'POST', body: 'A' })).status).toBe(400);
        expect((await chunk(id, 'x', 'A')).status).toBe(400);
        expect((await chunk(id, -1, 'A')).status).toBe(400);
        expect((await chunk(id, 0, '')).status).toBe(400);
        expect((await chunk(9999, 0, 'A')).status).toBe(404);
    });
});

describe('POST /sessions/:id/finalize', () => {
    it('verifies the chunk count: a mismatch is a 409 and the recording stays open', async () => {
        const id = await start();
        await chunk(id, 0, 'A');
        const { status, body } = await json<{ received: number }>(await post(`/sessions/${id}/finalize`, { chunk_count: 2 }));
        expect(status).toBe(409);
        expect(body.data).toEqual({ received: 1 });
        expect(repo_sessions.selectSessionById(id)!.status).toBe('recording');
    });

    it('finalises, then the pipeline transcribes and summarizes the recording to ready', async () => {
        const id = await start();
        await chunk(id, 0, 'AAA');
        await chunk(id, 1, 'BBB');
        spies.push(spyOn(svc_deepgram, 'transcribeDiarized').mockResolvedValue({ utterances: [{ speaker: 0, transcript: 'Hello David.', start: 0, end: 2 }], duration_sec: 1800 }));

        const { status, body } = await json<Session>(await post(`/sessions/${id}/finalize`, { chunk_count: 2 }));
        expect(status).toBe(200);
        expect(body.data).toMatchObject({ id, source: 'recording', status: 'uploaded' });

        await pipelineIdle();
        const done = await json<Session>(await app.request(`/sessions/${id}`));
        expect(done.body.data).toMatchObject({ status: 'ready', transcript: '[00:00] Speaker 0: Hello David.', duration_sec: 1800, summary: SUMMARY });
    });

    it('with no Deepgram key the session fails clearly, keeps its audio, and Retry works once it is configured', async () => {
        const id = await start();
        await chunk(id, 0, 'AAA');
        await post(`/sessions/${id}/finalize`, { chunk_count: 1 });
        await pipelineIdle();

        const failed = await json<Session>(await app.request(`/sessions/${id}`));
        expect(failed.body.data).toMatchObject({ status: 'failed', error: 'Transcription is not configured (DEEPGRAM_API_KEY)' });
        expect(existsSync(audioFile(repo_sessions.selectSessionById(id)!))).toBe(true);

        spies.push(spyOn(svc_deepgram, 'transcribeDiarized').mockResolvedValue({ utterances: [{ speaker: 0, transcript: 'Hi', start: 0, end: 1 }], duration_sec: 2 }));
        await post(`/sessions/${id}/retry`);
        await pipelineIdle();
        expect(repo_sessions.selectSessionById(id)!.status).toBe('ready');
    });

    it('validates chunk_count and the session', async () => {
        const id = await start();
        expect((await post(`/sessions/${id}/finalize`, {})).status).toBe(400);
        expect((await post(`/sessions/${id}/finalize`, { chunk_count: 0 })).status).toBe(400);
        expect((await post(`/sessions/${id}/finalize`, { chunk_count: 1 })).status).toBe(400); // nothing recorded
        expect((await post('/sessions/9999/finalize', { chunk_count: 1 })).status).toBe(404);
    });
});

describe('DELETE /sessions/:id for a recording', () => {
    it('removes the audio folder with the row', async () => {
        const id = await start();
        await chunk(id, 0, 'AAA');
        expect(existsSync(recordingDir(id))).toBe(true);
        expect((await app.request(`/sessions/${id}`, { method: 'DELETE' })).status).toBe(200);
        expect(existsSync(recordingDir(id))).toBe(false);
    });
});
