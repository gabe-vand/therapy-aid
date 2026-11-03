import { useCallback, useEffect, useRef, useState } from 'react';
import { isOk, postAPI } from '@/services/api';
import { useChunkUpload } from '@/services/hooks/use-chunk-upload';
import { useWakeLock } from '@/services/hooks/use-wake-lock';

/* Records the therapy session in the browser and ships it to the server as it goes, so a dead
   battery or a crashed tab loses at most the last 30 seconds instead of the whole hour.

   Flow: getUserMedia -> POST /sessions/recordings (gets the id) -> MediaRecorder.start(30000);
   every dataavailable blob is numbered and handed to the upload queue (use-chunk-upload).
   stop() ends the recorder, waits for the queue to empty, then POST /sessions/:id/finalize with the
   chunk count — the server verifies none went missing and starts transcription. Leaving the page
   mid-recording stops and finalizes what exists rather than discarding it. */

export type RecorderPhase = 'idle' | 'starting' | 'recording' | 'finishing' | 'done';

export const TIMESLICE_MS = 30_000;
// Safari only does mp4; Chrome/Firefox prefer webm/opus. The first the browser supports wins.
export const MIME_PREFERENCE = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

const pick_mime = (): string => MIME_PREFERENCE.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

const mic_message = (e: unknown): string => {
    const name = e instanceof Error ? e.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone access is blocked. Allow it in your browser’s site settings, then try again.';
    if (name === 'NotFoundError') return 'No microphone was found on this device.';
    return 'Could not start the microphone. Check that no other app is using it.';
};

// Resolves once the recorder has flushed its last chunk and stopped.
const halt = (recorder: MediaRecorder) =>
    new Promise<void>((resolve) => {
        if (recorder.state === 'inactive') return resolve();
        recorder.onstop = () => resolve();
        recorder.stop();
    });

export const useRecorder = () => {
    const [phase, set_phase_state] = useState<RecorderPhase>('idle');
    const [elapsed_sec, set_elapsed_sec] = useState(0);
    const [error, set_error] = useState<string | null>(null);
    const [session_id, set_session_id] = useState<number | null>(null);
    const { uploaded, total, stalled, begin, enqueue, drain, pending } = useChunkUpload();

    // phase_ref is the synchronous truth (guards double taps and async continuations); the state mirrors it for render.
    const phase_ref = useRef<RecorderPhase>('idle');
    const recorder = useRef<MediaRecorder | null>(null);
    const stream = useRef<MediaStream | null>(null);
    const id = useRef<number | null>(null);
    const chunk_count = useRef(0);
    const started_at = useRef(0);
    const mounted = useRef(true);

    const set_phase = useCallback((next: RecorderPhase) => {
        phase_ref.current = next;
        set_phase_state(next);
    }, []);

    const release_mic = useCallback(() => {
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = null;
        recorder.current = null;
    }, []);

    const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
    const secure = typeof window === 'undefined' || window.isSecureContext !== false;

    const start = useCallback(async () => {
        if (phase_ref.current !== 'idle') return;
        if (!supported) {
            set_error('This browser cannot record audio. Try Safari or Chrome over HTTPS.');
            return;
        }
        set_phase('starting');
        set_error(null);

        // Mic first: a refused permission must not leave an empty session behind on the server.
        let media: MediaStream;
        try {
            media = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            set_error(mic_message(e));
            set_phase('idle');
            return;
        }
        const abort = (message: string | null) => {
            media.getTracks().forEach((t) => t.stop());
            if (message) set_error(message);
            set_phase('idle');
        };
        if (!mounted.current) return abort(null);

        let rec: MediaRecorder;
        try {
            const picked = pick_mime();
            rec = new MediaRecorder(media, picked ? { mimeType: picked } : undefined);
        } catch {
            return abort('This browser could not start recording audio.');
        }
        // The server maps the mime to a file extension; codec parameters would only get in the way.
        const mime = (rec.mimeType || 'audio/webm').split(';')[0]!;

        const res = await postAPI<{ id: number }>('sessions/recordings', { mime });
        if (!isOk(res)) return abort(res.message);
        if (!mounted.current) return abort(null);

        id.current = res.data.id;
        chunk_count.current = 0;
        begin(res.data.id, mime);
        rec.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0) enqueue(chunk_count.current++, e.data);
        };
        stream.current = media;
        recorder.current = rec;
        rec.start(TIMESLICE_MS);
        started_at.current = Date.now();
        set_elapsed_sec(0);
        set_phase('recording');
    }, [begin, enqueue, set_phase, supported]);

    // Empties the queue, then tells the server how many chunks to expect. Safe to call again after a failure.
    const finish = useCallback(async (): Promise<number | null> => {
        set_error(null);
        await drain();
        if (pending() > 0) {
            set_error('Some audio has not uploaded yet. Check your connection and try again — it is kept safely until then.');
            return null;
        }
        if (chunk_count.current === 0) {
            set_error('Nothing was recorded.');
            set_phase('idle');
            return null;
        }
        const res = await postAPI(`sessions/${id.current}/finalize`, { chunk_count: chunk_count.current });
        if (res.status_code !== 200) {
            set_error(res.message);
            return null;
        }
        set_session_id(id.current);
        set_phase('done');
        return id.current;
    }, [drain, pending, set_phase]);

    const stop = useCallback(async (): Promise<number | null> => {
        const rec = recorder.current;
        if (phase_ref.current !== 'recording' || !rec) return null;
        set_phase('finishing');
        await halt(rec);
        release_mic();
        return finish();
    }, [finish, release_mic, set_phase]);

    // After a failed finish: upload what is left and finalize.
    const retry = useCallback(async (): Promise<number | null> => (phase_ref.current === 'finishing' ? finish() : null), [finish]);

    // Elapsed clock, derived from the wall clock so a throttled background tab cannot drift it.
    useEffect(() => {
        if (phase !== 'recording') return;
        const timer = setInterval(() => set_elapsed_sec(Math.floor((Date.now() - started_at.current) / 1000)), 1000);
        return () => clearInterval(timer);
    }, [phase]);

    useWakeLock(phase === 'recording');

    // Closing the tab mid-recording would lose the unsent tail: make the browser ask first.
    useEffect(() => {
        if (phase !== 'recording' && phase !== 'finishing') return;
        const guard = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', guard);
        return () => window.removeEventListener('beforeunload', guard);
    }, [phase]);

    // Navigating away inside the app: salvage the recording instead of dropping it.
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            if (phase_ref.current === 'recording') void stop();
        };
    }, [stop]);

    return { phase, elapsed_sec, uploaded, total, stalled, error, session_id, supported, secure, start, stop, retry };
};
