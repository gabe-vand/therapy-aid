import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TIMESLICE_MS, useRecorder } from '@/services/hooks/use-recorder';
import { envelope, sent_body, stub_api } from '../../helpers/hlp-fetch';
import { FakeRecorder, flush, install_fake_media, server, started, use_fake_clock } from '../../helpers/hlp-recorder';

use_fake_clock();

describe('useRecorder start', () => {
    it('uses the first supported mime, creates the session and starts with a 30s timeslice', async () => {
        const media = install_fake_media();
        FakeRecorder.supported = ['audio/webm'];
        const s = server();
        const { result } = await started();
        expect(result.current.phase).toBe('recording');
        expect(media.recorder().timeslice).toBe(TIMESLICE_MS);
        expect(media.recorder().mimeType).toBe('audio/webm');
        expect(sent_body(s.mock, 0)).toEqual({ mime: 'audio/webm' });
    });

    it('prefers webm/opus and strips codec parameters before telling the server', async () => {
        const media = install_fake_media();
        const s = server();
        await started();
        expect(media.recorder().mimeType).toBe('audio/webm;codecs=opus');
        expect(sent_body(s.mock, 0)).toEqual({ mime: 'audio/webm' });
    });

    it('falls back to mp4 for Safari', async () => {
        const media = install_fake_media();
        FakeRecorder.supported = ['audio/mp4'];
        const s = server();
        await started();
        expect(media.recorder().mimeType).toBe('audio/mp4');
        expect(sent_body(s.mock, 0)).toEqual({ mime: 'audio/mp4' });
    });

    it('explains a blocked microphone and creates no session', async () => {
        install_fake_media({ deny: 'NotAllowedError' });
        const s = server();
        const { result } = await started();
        expect(result.current.phase).toBe('idle');
        expect(result.current.error).toMatch(/blocked/i);
        expect(s.mock).not.toHaveBeenCalled();
    });

    it('releases the mic when the server refuses the new session', async () => {
        const media = install_fake_media();
        stub_api({ 'POST /api/sessions/recordings': envelope(null, 500, 'Disk full.') });
        const { result } = await started();
        expect(result.current.error).toBe('Disk full.');
        expect(result.current.phase).toBe('idle');
        expect(media.track.stop).toHaveBeenCalled();
    });

    it('reports an unsupported browser', async () => {
        vi.stubGlobal('navigator', { userAgent: 'test' });
        const { result } = renderHook(() => useRecorder());
        expect(result.current.supported).toBe(false);
        await act(async () => void (await result.current.start()));
        expect(result.current.error).toMatch(/cannot record/i);
    });
});

describe('useRecorder session life', () => {
    it('counts elapsed seconds from the wall clock', async () => {
        install_fake_media();
        server();
        const { result } = await started();
        await flush(5000);
        expect(result.current.elapsed_sec).toBe(5);
    });

    it('guards beforeunload only while recording', async () => {
        const media = install_fake_media();
        server();
        const { result } = renderHook(() => useRecorder());
        const fire = () => {
            const e = new Event('beforeunload', { cancelable: true });
            window.dispatchEvent(e);
            return e.defaultPrevented;
        };
        expect(fire()).toBe(false);
        await act(async () => void (await result.current.start()));
        expect(fire()).toBe(true);
        act(() => media.recorder().emit('a'));
        await act(async () => void (await result.current.stop()));
        expect(fire()).toBe(false);
    });

    it('requests a wake lock while recording and releases it after', async () => {
        const media = install_fake_media();
        server();
        const release = vi.fn(async () => undefined);
        const request = vi.fn(async () => ({ release }));
        vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [media.track] }) }, wakeLock: { request }, userAgent: 'test' });
        const { result } = await started();
        await flush();
        expect(request).toHaveBeenCalledWith('screen');
        await act(async () => void (await result.current.stop()));
        await flush();
        expect(release).toHaveBeenCalled();
    });

    it('still records with no wake lock API at all', async () => {
        install_fake_media();
        server();
        const { result } = await started();
        expect(result.current.phase).toBe('recording');
    });

    it('saves what exists when the page is left mid-recording', async () => {
        const media = install_fake_media();
        const s = server();
        const { unmount } = await started();
        act(() => media.recorder().emit('a'));
        unmount();
        await flush();
        expect(media.recorder().state).toBe('inactive');
        expect(s.finalized()).toBe(true);
    });
});
