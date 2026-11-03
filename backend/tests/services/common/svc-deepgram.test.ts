import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { TranscriptionError, TranscriptionNotConfiguredError, formatUtterances, transcribeDiarized } from '@/services/common/svc-deepgram';
import { app_env } from '@/services/common/svc-env';

// Deepgram over a stubbed global fetch — the request we send and every failure mode.

const ok_body = {
    metadata: { duration: 61.5 },
    results: {
        utterances: [
            { speaker: 0, transcript: ' How was the week? ', start: 0.4, end: 2 },
            { speaker: 1, transcript: '', start: 2, end: 2.1 },
            { speaker: 1, transcript: 'Rough nights again.', start: 65.2, end: 67 },
        ],
    },
};

let fetch_spy: ReturnType<typeof spyOn> | null = null;
const stubFetch = (impl: (url: string, init: RequestInit) => Promise<Response>) => {
    fetch_spy = spyOn(globalThis, 'fetch').mockImplementation(impl as unknown as typeof fetch);
};

beforeEach(() => {
    app_env.deepgram_api_key = 'dg-test';
    spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    fetch_spy?.mockRestore();
    fetch_spy = null;
    app_env.deepgram_api_key = '';
    (console.error as unknown as { mockRestore: () => void }).mockRestore();
});

describe('transcribeDiarized', () => {
    it('fails cleanly, before any request, when DEEPGRAM_API_KEY is unset', async () => {
        app_env.deepgram_api_key = '';
        stubFetch(async () => new Response('{}'));
        const call = transcribeDiarized(new Uint8Array([1]), 'audio/webm');
        await expect(call).rejects.toBeInstanceOf(TranscriptionNotConfiguredError);
        await expect(call).rejects.toThrow('Transcription is not configured (DEEPGRAM_API_KEY)');
        expect(fetch_spy).not.toHaveBeenCalled();
    });

    it('posts the bytes with diarization on and returns the non-empty utterances', async () => {
        stubFetch(async () => Response.json(ok_body));
        const result = await transcribeDiarized(new Uint8Array([1, 2, 3]), 'audio/webm');

        const [url, init] = fetch_spy!.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('diarize=true');
        expect(url).toContain('utterances=true');
        expect(url).toContain('model=nova-3');
        expect(init.method).toBe('POST');
        expect(init.headers).toMatchObject({ Authorization: 'Token dg-test', 'Content-Type': 'audio/webm' });
        expect(result.duration_sec).toBe(61.5);
        expect(result.utterances).toEqual([
            { speaker: 0, transcript: 'How was the week?', start: 0.4, end: 2 },
            { speaker: 1, transcript: 'Rough nights again.', start: 65.2, end: 67 },
        ]);
    });

    it('names the key on a 401', async () => {
        stubFetch(async () => new Response('bad key', { status: 401 }));
        await expect(transcribeDiarized(new Uint8Array([1]), 'audio/webm')).rejects.toThrow(/DEEPGRAM_API_KEY/);
    });

    it('wraps other HTTP errors and network failures in TranscriptionError', async () => {
        stubFetch(async () => new Response('boom', { status: 502 }));
        await expect(transcribeDiarized(new Uint8Array([1]), 'audio/webm')).rejects.toThrow('Transcription failed (HTTP 502). Try again.');
        fetch_spy!.mockRestore();
        stubFetch(async () => Promise.reject(new TypeError('network down')));
        await expect(transcribeDiarized(new Uint8Array([1]), 'audio/webm')).rejects.toBeInstanceOf(TranscriptionError);
    });
});

describe('formatUtterances', () => {
    it('renders [mm:ss] Speaker N: text, one line each', () => {
        expect(
            formatUtterances([
                { speaker: 0, transcript: 'Hi.', start: 5.9, end: 6 },
                { speaker: 1, transcript: 'Hey.', start: 125, end: 126 },
            ]),
        ).toBe('[00:05] Speaker 0: Hi.\n[02:05] Speaker 1: Hey.');
    });
});
