import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { utimesSync } from 'node:fs';
import { join } from 'node:path';
import * as repo_sessions from '@/repositories/sessions';
import { sqlite } from '@/services/common/svc-db';
import { recordingDir } from '@/services/sessions/audio-files';
import { pipelineIdle } from '@/services/sessions/pipeline';
import { appendChunk, createRecording, finalizeRecording } from '@/services/sessions/recordings';
import { ABANDONED_AFTER_MS, abandonStaleRecordings, recoverStuckSessions, startRecordingSweep } from '@/services/sessions/recovery';
import { resetDatabase } from '../../helpers/hlp-db';
import { clearRecordings, stubClaude, stubFocus, tracker, uploadedNotes } from './fixtures';

// Abandoned recordings (a dead phone, a closed tab) and boot recovery: idle time runs from the
// newest audio file, the sweep keeps the audio for Retry, and finalize can salvage what landed.

const { track, restore } = tracker();
const bytes = (text: string) => new TextEncoder().encode(text);
const HOUR = 60 * 60 * 1000;

/** Backdates a recording's row and every file in its folder by `ms`. */
const age = (id: number, ms: number) => {
    const then = new Date(Date.now() - ms);
    sqlite.run('update sessions set created_at = ? where id = ?', [then.toISOString(), id]);
    for (const name of ['chunk-0', 'chunk-1', 'audio.webm']) {
        try {
            utimesSync(join(recordingDir(id), name), then, then);
        } catch {
            // that file does not exist for this recording
        }
    }
};

beforeEach(() => {
    resetDatabase();
    clearRecordings();
    track(stubClaude());
    track(stubFocus());
    track(spyOn(console, 'log').mockImplementation(() => {}));
    track(spyOn(console, 'error').mockImplementation(() => {}));
});
afterEach(async () => {
    await pipelineIdle();
    restore();
});

describe('abandonStaleRecordings', () => {
    it('fails a recording idle for longer than the threshold, keeping its audio for Retry', () => {
        const row = createRecording({ mime: 'audio/webm' });
        appendChunk(row.id, 0, bytes('first'));
        age(row.id, ABANDONED_AFTER_MS + 60_000);
        expect(abandonStaleRecordings()).toBe(1);
        const after = repo_sessions.selectSessionById(row.id)!;
        expect(after.status).toBe('failed');
        expect(after.error).toContain('press Retry');
        expect(after.audio_path).toContain('audio.webm');
    });

    it('measures idle time from the newest chunk, not from when the recording started', () => {
        const row = createRecording({ mime: 'audio/webm' });
        sqlite.run('update sessions set created_at = ? where id = ?', [new Date(Date.now() - 2 * HOUR).toISOString(), row.id]);
        appendChunk(row.id, 0, bytes('still talking')); // landed just now
        expect(abandonStaleRecordings()).toBe(0);
        expect(repo_sessions.selectSessionById(row.id)!.status).toBe('recording');
    });

    it('fails a recording that never got any audio, saying so', () => {
        const row = createRecording({ mime: 'audio/webm' });
        age(row.id, ABANDONED_AFTER_MS + 60_000);
        abandonStaleRecordings();
        expect(repo_sessions.selectSessionById(row.id)!).toMatchObject({ status: 'failed', error: 'This recording was never finished and no audio was saved.', audio_path: null });
    });

    it('leaves a fresh recording alone', () => {
        createRecording({ mime: 'audio/webm' });
        expect(abandonStaleRecordings()).toBe(0);
    });

    it('runs on a timer, not only at boot', () => {
        const timer = startRecordingSweep();
        clearInterval(timer);
        expect(timer).toBeDefined();
    });
});

describe('recoverStuckSessions', () => {
    it('re-queues interrupted sessions and sweeps abandoned recordings in one pass', async () => {
        const notes = uploadedNotes();
        const recording = createRecording({ mime: 'audio/webm' });
        age(recording.id, ABANDONED_AFTER_MS + 60_000);
        recoverStuckSessions();
        await pipelineIdle();
        expect(repo_sessions.selectSessionById(notes.id)!.status).toBe('ready');
        expect(repo_sessions.selectSessionById(recording.id)!.status).toBe('failed');
    });
});

describe('finalizeRecording without a chunk count (the salvage path)', () => {
    it('takes every chunk on disk and starts processing', () => {
        const row = createRecording({ mime: 'audio/webm' });
        appendChunk(row.id, 0, bytes('a'));
        appendChunk(row.id, 1, bytes('b'));
        expect(finalizeRecording(row.id).status).toBe('uploaded');
    });
});
