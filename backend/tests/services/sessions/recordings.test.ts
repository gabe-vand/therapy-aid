import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as repo_sessions from '@/repositories/sessions';
import { audioFile, baseMime, extensionFor, recordingDir } from '@/services/sessions/audio-files';
import { ChunkCountError, ChunkOrderError, SessionInputError, SessionNotFoundError, SessionStateError } from '@/services/sessions/errors';
import { pipelineIdle } from '@/services/sessions/pipeline';
import { appendChunk, createRecording, finalizeRecording } from '@/services/sessions/recordings';
import { removeSession } from '@/services/sessions/sessions';
import { resetDatabase } from '../../helpers/hlp-db';
import { clearRecordings, stubClaude, stubFocus } from './fixtures';

// Chunked recording intake: strict ordering, the lost-ack retry, finalize verification, and that
// deleting a session removes its audio folder.

const bytes = (text: string) => new TextEncoder().encode(text);
let spies: { mockRestore: () => void }[] = [];

beforeEach(() => {
    resetDatabase();
    clearRecordings();
    // Finalize kicks off processing; keep it off the network (the pipeline fails/finishes harmlessly).
    spies = [stubClaude(), stubFocus(), spyOn(console, 'log').mockImplementation(() => {}), spyOn(console, 'error').mockImplementation(() => {})];
});
afterEach(async () => {
    await pipelineIdle();
    for (const s of spies) s.mockRestore();
});

describe('mime handling', () => {
    it('maps mime types to extensions, ignoring codec parameters', () => {
        expect(extensionFor('audio/webm;codecs=opus')).toBe('webm');
        expect(extensionFor('audio/mp4')).toBe('m4a');
        expect(extensionFor('audio/ogg')).toBe('ogg');
        expect(extensionFor('audio/something-else')).toBe('bin');
        expect(baseMime('Audio/WebM; codecs=opus')).toBe('audio/webm');
    });
});

describe('createRecording', () => {
    it('makes a recording-status row and its folder, storing the base mime', () => {
        const row = createRecording({ mime: 'audio/webm;codecs=opus', occurred_at: '2026-09-11T16:00:00.000Z' });
        expect(row).toMatchObject({ source: 'recording', status: 'recording', audio_mime: 'audio/webm', occurred_at: '2026-09-11T16:00:00.000Z' });
        expect(existsSync(recordingDir(row.id))).toBe(true);
    });
});

describe('appendChunk', () => {
    it('accepts chunks in order and appends them to one audio file', () => {
        const row = createRecording({ mime: 'audio/webm' });
        expect(appendChunk(row.id, 0, bytes('AAA'))).toBe(1);
        expect(appendChunk(row.id, 1, bytes('BB'))).toBe(2);
        expect(appendChunk(row.id, 2, bytes('C'))).toBe(3);
        expect(readFileSync(audioFile(row), 'utf8')).toBe('AAABBC');
        expect(readdirSync(recordingDir(row.id)).sort()).toEqual(['audio.webm', 'chunk-0', 'chunk-1', 'chunk-2']);
    });

    it('rejects a gap and a first chunk that is not 0, reporting the expected seq', () => {
        const row = createRecording({ mime: 'audio/webm' });
        expect(() => appendChunk(row.id, 1, bytes('X'))).toThrow(ChunkOrderError);
        appendChunk(row.id, 0, bytes('A'));
        try {
            appendChunk(row.id, 5, bytes('X'));
            throw new Error('should have thrown');
        } catch (e) {
            expect((e as ChunkOrderError).expected).toBe(1);
        }
        expect(readFileSync(audioFile(row), 'utf8')).toBe('A');
    });

    it('acknowledges a re-sent identical chunk (lost ack) without appending twice, but rejects different bytes', () => {
        const row = createRecording({ mime: 'audio/webm' });
        appendChunk(row.id, 0, bytes('AAA'));
        appendChunk(row.id, 1, bytes('BBB'));
        expect(appendChunk(row.id, 0, bytes('AAA'))).toBe(2);
        expect(readFileSync(audioFile(row), 'utf8')).toBe('AAABBB');
        expect(() => appendChunk(row.id, 0, bytes('ZZZ'))).toThrow(ChunkOrderError);
    });

    it('rejects an empty chunk, an unknown session and a finished recording', () => {
        const row = createRecording({ mime: 'audio/webm' });
        expect(() => appendChunk(row.id, 0, new Uint8Array())).toThrow(SessionInputError);
        expect(() => appendChunk(424242, 0, bytes('A'))).toThrow(SessionNotFoundError);
        appendChunk(row.id, 0, bytes('A'));
        finalizeRecording(row.id, 1);
        expect(() => appendChunk(row.id, 1, bytes('B'))).toThrow(SessionStateError);
    });
});

describe('finalizeRecording', () => {
    it('verifies the count, sets status uploaded with the audio path, removes the chunk files and starts processing', async () => {
        const row = createRecording({ mime: 'audio/webm' });
        appendChunk(row.id, 0, bytes('AAA'));
        appendChunk(row.id, 1, bytes('BBB'));

        const done = finalizeRecording(row.id, 2);

        expect(done.status).toBe('uploaded');
        expect(done.audio_path).toBe(audioFile(row));
        expect(readFileSync(done.audio_path!, 'utf8')).toBe('AAABBB');
        expect(readdirSync(recordingDir(row.id))).toEqual(['audio.webm']);
        await pipelineIdle();
        // Processing ran: Deepgram is not configured in tests, so it failed cleanly with the audio intact.
        expect(repo_sessions.selectSessionById(row.id)!.status).toBe('failed');
        expect(existsSync(done.audio_path!)).toBe(true);
    });

    it('refuses a count that does not match what landed, and stays open for more chunks', () => {
        const row = createRecording({ mime: 'audio/webm' });
        appendChunk(row.id, 0, bytes('A'));
        appendChunk(row.id, 1, bytes('B'));
        try {
            finalizeRecording(row.id, 3);
            throw new Error('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(ChunkCountError);
            expect((e as ChunkCountError).received).toBe(2);
        }
        expect(repo_sessions.selectSessionById(row.id)!.status).toBe('recording');
        expect(appendChunk(row.id, 2, bytes('C'))).toBe(3);
    });

    it('refuses to finalize a recording with no chunks', () => {
        const row = createRecording({ mime: 'audio/webm' });
        expect(() => finalizeRecording(row.id, 1)).toThrow(SessionInputError);
    });

    it('rebuilds the audio from the chunks when the append was lost in a crash', () => {
        const row = createRecording({ mime: 'audio/webm' });
        appendChunk(row.id, 0, bytes('AAA'));
        writeFileSync(join(recordingDir(row.id), 'chunk-1'), bytes('BBB')); // chunk landed, append did not
        const done = finalizeRecording(row.id, 2);
        expect(readFileSync(done.audio_path!, 'utf8')).toBe('AAABBB');
    });

    it('is a no-op when called again on an already-finalised recording', () => {
        const row = createRecording({ mime: 'audio/webm' });
        appendChunk(row.id, 0, bytes('A'));
        const first = finalizeRecording(row.id, 1);
        expect(finalizeRecording(row.id, 1).id).toBe(first.id);
    });
});

describe('removeSession', () => {
    it('deletes the row and the whole audio folder', () => {
        const row = createRecording({ mime: 'audio/webm' });
        appendChunk(row.id, 0, bytes('A'));
        expect(existsSync(recordingDir(row.id))).toBe(true);

        removeSession(row.id);

        expect(repo_sessions.selectSessionById(row.id)).toBeNull();
        expect(existsSync(recordingDir(row.id))).toBe(false);
    });

    it('tolerates an audio folder that is already gone', () => {
        const row = createRecording({ mime: 'audio/webm' });
        rmSync(recordingDir(row.id), { recursive: true, force: true });
        expect(() => removeSession(row.id)).not.toThrow();
    });
});
