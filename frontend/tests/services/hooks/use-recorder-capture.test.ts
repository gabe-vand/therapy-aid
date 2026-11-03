import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CHUNK_SILENCE_MS, MUTED_WARNING, SILENT_WARNING } from '@/services/hooks/use-capture-guard';
import { useRecorder } from '@/services/hooks/use-recorder';
import { stub_api } from '../../helpers/hlp-fetch';
import { flush, install_fake_media, server, started, use_fake_clock } from '../../helpers/hlp-recorder';

/* The recorder when capture fails under it (use-capture-guard), and the server rows it must not
   leave behind. */

use_fake_clock();

describe('useRecorder when capture dies', () => {
    it('a recorder error saves what was captured, finalizes, and says when it stopped', async () => {
        const media = install_fake_media();
        const s = server();
        const { result } = await started();
        await flush(12_000);
        act(() => media.recorder().emit('a'));
        act(() => media.recorder().fail());
        await flush(1000);
        expect(s.finalized()).toBe(true);
        expect(result.current.phase).toBe('done');
        expect(result.current.notice).toMatch(/Recording stopped unexpectedly at 00:12/);
        expect(s.attempts.map((a) => a.seq)).toEqual([0, 1]);
    });

    it('an ended mic track stops and saves the recording too', async () => {
        const media = install_fake_media();
        const s = server();
        const { result } = await started();
        act(() => media.recorder().emit('a'));
        act(() => media.track.onended?.());
        await flush(1000);
        expect(media.recorder().state).toBe('inactive');
        expect(s.finalized()).toBe(true);
        expect(result.current.notice).toMatch(/microphone was cut off/);
    });

    it('a muted track warns until it unmutes, and keeps recording', async () => {
        const media = install_fake_media();
        server();
        const { result } = await started();
        act(() => media.track.onmute?.());
        expect(result.current.capture_warning).toBe(MUTED_WARNING);
        expect(result.current.phase).toBe('recording');
        act(() => media.track.onunmute?.());
        expect(result.current.capture_warning).toBeNull();
    });

    it('warns when no chunk arrives for two timeslices, and clears on the next chunk', async () => {
        const media = install_fake_media();
        server();
        const { result } = await started();
        await flush(CHUNK_SILENCE_MS - 10_000);
        expect(result.current.capture_warning).toBeNull();
        await flush(15_000);
        expect(result.current.capture_warning).toBe(SILENT_WARNING);
        act(() => media.recorder().emit('a'));
        expect(result.current.capture_warning).toBeNull();
    });

    it('a normal stop sets no notice', async () => {
        const media = install_fake_media();
        server();
        const { result } = await started();
        act(() => media.recorder().emit('a'));
        await act(async () => void (await result.current.stop()));
        expect(result.current.notice).toBeNull();
        act(() => media.track.onended?.());
        expect(result.current.notice).toBeNull();
    });
});

describe('useRecorder leaves no empty sessions behind', () => {
    it('deletes the row when nothing was recorded', async () => {
        const media = install_fake_media();
        const s = server();
        const { result } = await started();
        media.recorder().final_chunk = null;
        await act(async () => void (await result.current.stop()));
        await flush();
        expect(result.current.error).toBe('Nothing was recorded.');
        expect(s.deleted()).toBe(true);
        expect(s.finalized()).toBe(false);
    });

    it('deletes the row when the page is left while the session is being created', async () => {
        install_fake_media();
        let release: () => void = () => undefined;
        const mock = stub_api({ 'POST /api/sessions/recordings': () => new Promise((resolve) => (release = () => resolve({ id: 7 }))), 'DELETE /api/sessions/7': {} });
        const { result, unmount } = renderHook(() => useRecorder());
        let starting: Promise<void> = Promise.resolve();
        act(() => void (starting = result.current.start()));
        await flush();
        unmount();
        release();
        await act(async () => void (await starting));
        expect(mock.mock.calls.some((c) => String(c[0]).endsWith('/sessions/7') && (c[1] as RequestInit).method === 'DELETE')).toBe(true);
    });

    it('Retry during recording resends a stalled chunk right away', async () => {
        const media = install_fake_media();
        let up = false;
        const s = server(() => (up ? { received: true } : new Response(JSON.stringify({ data: null, status_code: 503, message: 'Offline.' }), { status: 503 })));
        const { result } = await started();
        act(() => media.recorder().emit('a'));
        await flush(10_000);
        expect(result.current.stalled).not.toBeNull();
        up = true;
        await act(async () => void (await result.current.retry()));
        expect(result.current.uploaded).toBe(1);
        expect(result.current.phase).toBe('recording');
        expect(s.finalized()).toBe(false);
    });
});
