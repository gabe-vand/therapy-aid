/* The browser-media plumbing the recorder hook stands on: which mime to ask MediaRecorder for, how
   to word a refused microphone, how to stop a recorder and wait for its last chunk, and the
   mm:ss clock. Plain functions, no React — split from use-recorder so the hook stays one job. */

export const TIMESLICE_MS = 30_000;
// Safari only does mp4; Chrome/Firefox prefer webm/opus. The first the browser supports wins.
export const MIME_PREFERENCE = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

export const pick_mime = (): string => MIME_PREFERENCE.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

export const mic_message = (e: unknown): string => {
    const name = e instanceof Error ? e.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone access is blocked. Allow it in your browser’s site settings, then try again.';
    if (name === 'NotFoundError') return 'No microphone was found on this device.';
    return 'Could not start the microphone. Check that no other app is using it.';
};

/* Resolves once the recorder has flushed its last chunk and stopped. A recorder that is already
   inactive died on its own (an error): its last chunk and stop event are still on the way, so wait
   for the stop, or `grace_ms` at most. */
export const halt = (recorder: MediaRecorder, grace_ms = 1000) =>
    new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        if (recorder.state === 'inactive') return void setTimeout(resolve, grace_ms);
        recorder.stop();
    });

/* Seconds → "05:07", or "1:05:07" past an hour (the recorder's clock). */
export const format_elapsed = (total_sec: number): string => {
    const h = Math.floor(total_sec / 3600);
    const m = Math.floor((total_sec % 3600) / 60);
    const s = total_sec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
