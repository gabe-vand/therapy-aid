import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BACKOFF_MS } from '@/services/hooks/use-chunk-upload';
import { envelope, sent_body, stub_api } from '../../helpers/hlp-fetch';
import { flush, install_fake_media, server, started, use_fake_clock } from '../../helpers/hlp-recorder';

/* The upload queue behind the recorder: ordering, one in flight, 3 attempts with 2s backoff, and
   finalize only once everything is acked. */

use_fake_clock();

describe('recorder chunk uploads', () => {
    it('uploads chunks one at a time, in order, then finalizes with the chunk count', async () => {
        const media = install_fake_media();
        const s = server();
        const { result } = await started();

        act(() => {
            media.recorder().emit('a');
            media.recorder().emit('b');
            media.recorder().emit('c');
        });
        await flush();
        expect(result.current.total).toBe(3);
        expect(result.current.uploaded).toBe(3);

        let id: number | null = null;
        await act(async () => void (id = await result.current.stop()));
        expect(id).toBe(7);
        // 3 timeslices + the final flush on stop.
        expect(s.attempts.map((c) => c.seq)).toEqual([0, 1, 2, 3]);
        expect(s.attempts[0]!.type).toBe('audio/webm');
        expect(s.max_in_flight()).toBe(1);
        const finalize = s.mock.mock.calls.findIndex((c) => String(c[0]).endsWith('/finalize'));
        expect(sent_body(s.mock, finalize)).toEqual({ chunk_count: 4 });
        expect(result.current.phase).toBe('done');
        expect(result.current.session_id).toBe(7);
        expect(media.track.stop).toHaveBeenCalled();
    });

    it('retries a failing chunk after the backoff and carries on', async () => {
        const media = install_fake_media();
        const s = server((_seq, attempt) => (attempt < 3 ? envelope(null, 500, 'Flaky.') : { received: true }));
        const { result } = await started();

        act(() => media.recorder().emit('a'));
        await flush();
        expect(s.attempts).toHaveLength(1);
        await flush(BACKOFF_MS - 1);
        expect(s.attempts).toHaveLength(1);
        await flush(1);
        expect(s.attempts).toHaveLength(2);
        await flush(BACKOFF_MS);
        expect(s.attempts).toHaveLength(3);
        expect(result.current.uploaded).toBe(1);
        expect(result.current.stalled).toBeNull();
    });

    it('stalls after three attempts, keeps the chunk, and delivers it on the next try', async () => {
        const media = install_fake_media();
        let healthy = false;
        const s = server(() => (healthy ? { received: true } : envelope(null, 503, 'Offline.')));
        const { result } = await started();

        act(() => media.recorder().emit('a'));
        await flush(BACKOFF_MS * 3);
        expect(s.attempts).toHaveLength(3);
        expect(result.current.stalled).toBe('Offline.');
        expect(result.current.uploaded).toBe(0);

        // Network is back: stopping drains the kept chunk first, then finalizes.
        healthy = true;
        let id: number | null = null;
        await act(async () => void (id = await result.current.stop()));
        expect(id).toBe(7);
        expect(s.attempts.filter((c) => c.seq === 0)).toHaveLength(4);
        expect(result.current.stalled).toBeNull();
    });

    it('does not finalize while audio is still queued; retry finishes the job', async () => {
        const media = install_fake_media();
        let healthy = false;
        const s = server(() => (healthy ? { received: true } : envelope(null, 503, 'Offline.')));
        const { result } = await started();

        act(() => media.recorder().emit('a'));
        let stopping: Promise<number | null> = Promise.resolve(null);
        act(() => void (stopping = result.current.stop()));
        await flush(BACKOFF_MS * 10);
        expect(await stopping).toBeNull();
        expect(result.current.phase).toBe('finishing');
        expect(result.current.error).toMatch(/not uploaded/i);
        expect(s.finalized()).toBe(false);

        healthy = true;
        let id: number | null = null;
        await act(async () => void (id = await result.current.retry()));
        expect(id).toBe(7);
        expect(result.current.phase).toBe('done');
    });

    it('treats a 409 that says the server is already past this chunk as delivered', async () => {
        const media = install_fake_media();
        const s = server((seq) => (seq === 0 ? envelope({ expected: 1 }, 409, 'CONFLICT') : { received: true }));
        const { result } = await started();
        act(() => media.recorder().emit('a'));
        await flush();
        expect(result.current.uploaded).toBe(1);
        expect(s.attempts).toHaveLength(1);
    });

    it('refuses to finalize an empty recording', async () => {
        const media = install_fake_media();
        server();
        const { result } = await started();
        media.recorder().final_chunk = null;
        await act(async () => void (await result.current.stop()));
        expect(result.current.error).toBe('Nothing was recorded.');
        expect(result.current.phase).toBe('idle');
    });

    it('shows a finalize error and allows another try', async () => {
        const media = install_fake_media();
        let ok = false;
        stub_api({ 'POST /api/sessions/recordings': { id: 7 }, 'POST /api/sessions/7/chunks': { received: true }, 'POST /api/sessions/7/finalize': () => (ok ? { id: 7 } : envelope(null, 400, 'chunk_count: Expected 1 chunks.')) });
        const { result } = await started();
        media.recorder().final_chunk = null;
        act(() => media.recorder().emit('a'));
        await act(async () => void (await result.current.stop()));
        expect(result.current.error).toBe('chunk_count: Expected 1 chunks.');
        ok = true;
        await act(async () => void (await result.current.retry()));
        expect(result.current.phase).toBe('done');
    });
});
