import { useCallback, useEffect, useRef, useState } from 'react';
import { TIMESLICE_MS } from '@/services/recorder-media';

/* Watches a live recording for the failures MediaRecorder never announces on its own. iOS hands
   the microphone to a phone call, Siri or a locked screen and the recorder just goes quiet, while
   the timer (wall-clock derived) keeps counting — so without this the page says "Recording" over
   silence. Three signals:
   - the recorder's `error` or a mic track's `ended`: capture is over → `on_lost` (the recorder
     saves what exists and says so);
   - a track's `mute`: the OS took the mic, maybe only for a moment → a warning until `unmute`;
   - no chunk for two timeslices plus slack → a warning. Checked on an interval and again the
     moment the tab becomes visible (a hidden tab's timers are throttled). */

export const CHUNK_SILENCE_MS = 2 * TIMESLICE_MS + 15_000;
const CHECK_MS = 5_000;
export const SILENT_WARNING = 'No audio has reached this page for over a minute, so the microphone may have been interrupted. If the timer is still running but this does not clear, stop and start a new recording.';
export const MUTED_WARNING = 'The microphone was interrupted (a call, Siri or the system took it). Recording continues if it comes back.';

export const useCaptureGuard = (active: boolean) => {
    const [warning, set_warning] = useState<string | null>(null);
    const last_chunk_at = useRef(0);

    const mark_chunk = useCallback(() => {
        last_chunk_at.current = Date.now();
        set_warning((w) => (w === SILENT_WARNING ? null : w));
    }, []);

    // Wires the recorder and the mic tracks to `on_lost` / the mute warning.
    const watch = useCallback((rec: MediaRecorder, media: MediaStream, on_lost: () => void) => {
        rec.onerror = () => on_lost();
        for (const track of media.getTracks()) {
            track.onended = () => on_lost();
            track.onmute = () => set_warning(MUTED_WARNING);
            track.onunmute = () => set_warning((w) => (w === MUTED_WARNING ? null : w));
        }
    }, []);

    // The silence watchdog, live only while recording.
    useEffect(() => {
        if (!active) {
            set_warning(null);
            return;
        }
        last_chunk_at.current = Date.now();
        const check = () => {
            if (Date.now() - last_chunk_at.current > CHUNK_SILENCE_MS) set_warning((w) => w ?? SILENT_WARNING);
        };
        const timer = setInterval(check, CHECK_MS);
        document.addEventListener('visibilitychange', check);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', check);
        };
    }, [active]);

    return { warning, mark_chunk, watch };
};
