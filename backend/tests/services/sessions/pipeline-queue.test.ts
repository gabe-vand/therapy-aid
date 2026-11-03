import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as repo_updates from '@/repositories/problem-updates';
import * as repo_problems from '@/repositories/problems';
import * as repo_sessions from '@/repositories/sessions';
import { pipelineIdle, processSession } from '@/services/sessions/pipeline';
import { recoverStuckSessions } from '@/services/sessions/recovery';
import { clearRecordings, stubClaude, stubFocus, uploadedNotes, uploadedRecording, tracker } from './fixtures';
import { resetDatabase } from '../../helpers/hlp-db';

// One-at-a-time processing and boot recovery.

const { track, restore } = tracker();

beforeEach(() => {
    resetDatabase();
    clearRecordings();
    track(spyOn(console, 'log').mockImplementation(() => {}));
    track(spyOn(console, 'warn').mockImplementation(() => {}));
    track(spyOn(console, 'error').mockImplementation(() => {}));
});
afterEach(restore);

describe('queue and recovery', () => {
    it('processes sessions one at a time, so the second sees the problems the first opened', async () => {
        track(stubFocus());
        const claude = track(stubClaude({ problem_updates: [], new_problems: [{ title: 'Morning structure', description: 'd', progress_note: 'n' }] }));
        const first = uploadedNotes({ occurred_at: '2026-09-04T16:00:00.000Z' });
        const second = uploadedNotes({ occurred_at: '2026-09-11T16:00:00.000Z' });

        void processSession(first.id);
        await processSession(second.id);

        expect(claude.tasks()).toEqual(['summarize', 'map_problems', 'summarize', 'map_problems']);
        expect(claude.calls[3]!.user).toContain('Morning structure');
        expect(claude.calls[1]!.user).not.toContain('Morning structure');
        // The same title came back for the second session: it became a note, not a duplicate problem.
        expect(repo_problems.selectProblemsByStatus(['active'])).toHaveLength(1);
        expect(repo_updates.selectUpdatesForSession(second.id)).toHaveLength(1);
    });

    it('does nothing for a session that no longer exists, a ready one, or one still recording', async () => {
        const claude = track(stubClaude());
        const recording = repo_sessions.insertSession({ occurred_at: '2026-09-11T16:00:00.000Z', source: 'recording', status: 'recording' });
        await processSession(424242);
        await processSession(recording.id);
        expect(claude.calls).toHaveLength(0);
        expect(repo_sessions.selectSessionById(recording.id)!.status).toBe('recording');
    });

    it('recoverStuckSessions re-queues interrupted sessions and abandons old recordings, keeping partial audio', async () => {
        track(stubClaude());
        track(stubFocus());
        const stuck = uploadedNotes({ status: 'summarizing' });
        const open = uploadedRecording();
        repo_sessions.updateSession(open.id, { status: 'recording', audio_path: null });

        recoverStuckSessions();
        await pipelineIdle();
        expect(repo_sessions.selectSessionById(stuck.id)!.status).toBe('ready');
        expect(repo_sessions.selectSessionById(open.id)!.status).toBe('recording'); // young: left alone

        const real_now = Date.now();
        track(spyOn(Date, 'now').mockReturnValue(real_now + 7 * 60 * 60 * 1000));
        recoverStuckSessions();

        const abandoned = repo_sessions.selectSessionById(open.id)!;
        expect(abandoned.status).toBe('failed');
        expect(abandoned.error).toContain('never finished');
        expect(abandoned.audio_path).toContain('audio.webm');
    });
});
