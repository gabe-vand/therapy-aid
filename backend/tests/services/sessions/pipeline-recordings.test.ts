import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { existsSync } from 'node:fs';
import * as repo_sessions from '@/repositories/sessions';
import * as svc_deepgram from '@/services/common/svc-deepgram';
import { pipelineIdle, processSession, retrySession } from '@/services/sessions/pipeline';
import { clearRecordings, stubClaude, stubFocus, uploadedRecording, tracker } from './fixtures';
import { resetDatabase } from '../../helpers/hlp-db';

// Recording sessions: transcription, its status transitions, and the Deepgram-not-configured path that keeps the audio.

const { track, restore } = tracker();

beforeEach(() => {
    resetDatabase();
    clearRecordings();
    track(spyOn(console, 'log').mockImplementation(() => {}));
    track(spyOn(console, 'warn').mockImplementation(() => {}));
    track(spyOn(console, 'error').mockImplementation(() => {}));
});
afterEach(restore);

describe('processSession: recordings', () => {
    it('transcribes, then summarizes, with status transitions and a merged speaker-labelled transcript', async () => {
        track(stubFocus());
        const session = uploadedRecording();
        const seen: string[] = [];
        track(
            spyOn(svc_deepgram, 'transcribeDiarized').mockImplementation((async () => {
                seen.push(repo_sessions.selectSessionById(session.id)!.status);
                return {
                    utterances: [
                        { speaker: 1, transcript: 'How was your week?', start: 0.2, end: 2 },
                        { speaker: 0, transcript: 'Rough.', start: 3, end: 4 },
                        { speaker: 0, transcript: 'I could not sleep.', start: 4.5, end: 6 },
                    ],
                    duration_sec: 3601,
                };
            }) as never),
        );
        const claude = track(stubClaude());

        await processSession(session.id);

        const row = repo_sessions.selectSessionById(session.id)!;
        expect(seen).toEqual(['transcribing']);
        expect(row.transcript).toBe('[00:00] Speaker 1: How was your week?\n[00:03] Speaker 0: Rough. I could not sleep.');
        expect(row.duration_sec).toBe(3601);
        expect(row.status).toBe('ready');
        expect(claude.calls[0]!.user).toContain('Speaker 0: Rough. I could not sleep.');
        expect(claude.calls[0]!.user).toContain('TRANSCRIPT');
    });

    it('Deepgram not configured: fails with a clear error and leaves the audio and row intact', async () => {
        const claude = track(stubClaude());
        const session = uploadedRecording();

        await processSession(session.id);

        const row = repo_sessions.selectSessionById(session.id)!;
        expect(row.status).toBe('failed');
        expect(row.error).toBe('Transcription is not configured (DEEPGRAM_API_KEY)');
        expect(row.transcript).toBeNull();
        expect(existsSync(row.audio_path!)).toBe(true);
        expect(claude.calls).toHaveLength(0);
    });

    it('retry after a transcription failure transcribes again and keeps the transcript once stored', async () => {
        track(stubFocus());
        const session = uploadedRecording();
        await processSession(session.id); // not configured -> failed
        const transcribe = track(spyOn(svc_deepgram, 'transcribeDiarized').mockResolvedValue({ utterances: [{ speaker: 0, transcript: 'Hello', start: 0, end: 1 }], duration_sec: 5 }));
        track(stubClaude());

        retrySession(session.id);
        await pipelineIdle();

        expect(transcribe).toHaveBeenCalledTimes(1);
        expect(repo_sessions.selectSessionById(session.id)!.status).toBe('ready');
    });

    it('fails clearly when Deepgram finds no speech', async () => {
        const session = uploadedRecording();
        track(spyOn(svc_deepgram, 'transcribeDiarized').mockResolvedValue({ utterances: [], duration_sec: 3 }));
        await processSession(session.id);
        const row = repo_sessions.selectSessionById(session.id)!;
        expect(row.status).toBe('failed');
        expect(row.error).toBe('No speech was found in the recording.');
    });
});
