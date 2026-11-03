// Sessions a restart or a vanished browser left half-way. At boot, anything interrupted mid-pipeline
// is re-queued. And — at boot AND on a timer, because the Pi runs for weeks between restarts — a
// recording nobody has sent audio to for ABANDONED_AFTER_MS (a dead phone, a closed tab, a crashed
// browser) is failed with whatever audio was saved kept, so the session page offers Retry instead
// of sitting as "Recording" forever. Inactivity runs from the newest audio file's mtime, falling
// back to created_at for a recording that never got a chunk.
import type { SessionRow } from '@/repositories/sessions';
import * as repo_sessions from '@/repositories/sessions';
import { lastAudioActivityMs, partialAudioPath } from './audio-files';
import { processSession } from './pipeline';

export const ABANDONED_AFTER_MS = 30 * 60 * 1000;
export const SWEEP_EVERY_MS = 5 * 60 * 1000;

const lastActivityMs = (session: SessionRow): number => Math.max(Date.parse(session.created_at), lastAudioActivityMs(session.id) ?? 0);

/** Fails every recording idle for longer than ABANDONED_AFTER_MS. Returns how many it abandoned. */
export const abandonStaleRecordings = (now: number = Date.now()): number => {
    let abandoned = 0;
    for (const session of repo_sessions.selectSessionsByStatus(['recording'])) {
        if (now - lastActivityMs(session) <= ABANDONED_AFTER_MS) continue;
        const audio_path = partialAudioPath(session);
        const error = audio_path ? 'This recording was never finished. The audio captured so far was kept; press Retry to transcribe it.' : 'This recording was never finished and no audio was saved.';
        console.log(`[sessions] abandoning session ${session.id}: ${error}`);
        repo_sessions.updateSession(session.id, { status: 'failed', error, ...(audio_path ? { audio_path } : {}) });
        abandoned++;
    }
    return abandoned;
};

/** Boot recovery: re-queue anything a restart interrupted (oldest first), then sweep abandoned recordings. */
export const recoverStuckSessions = (): void => {
    for (const session of repo_sessions.selectSessionsByStatus(['uploaded', 'transcribing', 'summarizing'])) {
        console.log(`[sessions] re-queueing session ${session.id} (was ${session.status})`);
        void processSession(session.id);
    }
    abandonStaleRecordings();
};

/** Re-runs the abandon sweep every SWEEP_EVERY_MS for the life of the process. */
export const startRecordingSweep = (): ReturnType<typeof setInterval> =>
    setInterval(() => {
        try {
            abandonStaleRecordings();
        } catch (e) {
            console.error('[sessions] abandoned-recording sweep failed', e);
        }
    }, SWEEP_EVERY_MS);
