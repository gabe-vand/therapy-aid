import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { useRecorder } from '@/services/hooks/use-recorder';
import { stub_api } from './hlp-fetch';

/* happy-dom has neither getUserMedia nor MediaRecorder, so the recorder tests stub both on the
   window. FakeRecorder behaves like the real thing where it matters: stop() flushes one last
   dataavailable and THEN fires stop; emit() simulates a 30-second timeslice. */

export class FakeRecorder {
    static instances: FakeRecorder[] = [];
    static supported: string[] = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    static isTypeSupported = (mime: string) => FakeRecorder.supported.includes(mime);

    state: 'inactive' | 'recording' = 'inactive';
    mimeType: string;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    timeslice: number | undefined;
    final_chunk: Blob | null = new Blob(['tail']);

    constructor(
        public stream: unknown,
        options?: { mimeType?: string },
    ) {
        this.mimeType = options?.mimeType ?? '';
        FakeRecorder.instances.push(this);
    }

    start(timeslice?: number) {
        this.timeslice = timeslice;
        this.state = 'recording';
    }

    emit(text: string) {
        this.ondataavailable?.({ data: new Blob([text]) });
    }

    stop() {
        this.state = 'inactive';
        if (this.final_chunk) this.ondataavailable?.({ data: this.final_chunk });
        this.onstop?.();
    }
}

/* Installs the fakes; returns the getUserMedia mock and the track it hands out. */
export const install_fake_media = (opts: { deny?: string } = {}) => {
    FakeRecorder.instances = [];
    FakeRecorder.supported = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    const get_user_media = vi.fn(async () => {
        if (opts.deny) throw Object.assign(new Error('denied'), { name: opts.deny });
        return stream;
    });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: get_user_media }, userAgent: 'test' });
    return { get_user_media, track, recorder: () => FakeRecorder.instances[FakeRecorder.instances.length - 1]! };
};

/* Fake clock for the file, and an unmount that happens while fetch is still stubbed (leaving the
   page mid-recording finalizes in the background; that call must not reach the real network). */
export const use_fake_clock = () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(async () => {
        cleanup();
        await vi.advanceTimersByTimeAsync(10);
        vi.useRealTimers();
    });
};

export const flush = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

/* A server stub: creates session 7, records every chunk attempt, and lets a test script replies. */
export const server = (chunk_reply: (seq: number, attempt: number) => unknown = () => ({ received: true })) => {
    const attempts: { seq: number; type: string | null }[] = [];
    const per_seq = new Map<number, number>();
    let in_flight = 0;
    let max_in_flight = 0;
    const mock = stub_api({
        'POST /api/sessions/recordings': { id: 7 },
        'POST /api/sessions/7/chunks': async (init: RequestInit | undefined, url: string) => {
            const seq = Number(new URL(url, 'http://x').searchParams.get('seq'));
            const attempt = (per_seq.get(seq) ?? 0) + 1;
            per_seq.set(seq, attempt);
            attempts.push({ seq, type: new Headers(init?.headers).get('content-type') });
            max_in_flight = Math.max(max_in_flight, ++in_flight);
            await Promise.resolve();
            in_flight--;
            return chunk_reply(seq, attempt);
        },
        'POST /api/sessions/7/finalize': { id: 7, status: 'uploaded' },
    });
    const finalized = () => mock.mock.calls.some((c) => String(c[0]).endsWith('/finalize'));
    return { mock, attempts, max_in_flight: () => max_in_flight, finalized };
};

/* Renders the hook and taps Start. */
export const started = async () => {
    const hook = renderHook(() => useRecorder());
    await act(async () => void (await hook.result.current.start()));
    return hook;
};
