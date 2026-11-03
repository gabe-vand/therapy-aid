// Recording intake: the browser uploads audio in chunks while it records, so a dropped connection
// or a closed tab loses seconds, not the session. Each session owns a folder
// <recordings_dir>/<id>/ holding chunk-<seq> files and the growing audio.<ext>. Order is strict:
// a chunk is accepted only when its seq is the next one expected (the count already written), so
// the concatenation is always a valid stream. appendChunk is synchronous end to end — in a
// single-threaded runtime that makes check-then-write atomic without a lock.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SessionRow } from '@/repositories/sessions';
import * as repo_sessions from '@/repositories/sessions';
import { audioFile, baseMime, chunkSeqs, recordingDir } from './audio-files';
import { ChunkCountError, ChunkOrderError, SessionInputError, SessionNotFoundError, SessionStateError } from './errors';
import { processSession } from './pipeline';

const need = (id: number): SessionRow => {
    const session = repo_sessions.selectSessionById(id);
    if (!session) throw new SessionNotFoundError(id);
    return session;
};

/** Starts a recording session: row in status `recording` and its (empty) audio folder. */
export const createRecording = (input: { occurred_at?: string; mime: string }): SessionRow => {
    const row = repo_sessions.insertSession({ occurred_at: input.occurred_at ?? new Date().toISOString(), source: 'recording', status: 'recording', audio_mime: baseMime(input.mime) });
    mkdirSync(recordingDir(row.id), { recursive: true });
    return row;
};

/** Appends chunk `seq`. Returns the next expected seq. A re-sent chunk that already landed with
    identical bytes is acknowledged (the lost-ack case); any other wrong seq is a ChunkOrderError. */
export const appendChunk = (id: number, seq: number, bytes: Uint8Array): number => {
    const session = need(id);
    if (session.status !== 'recording') throw new SessionStateError('This recording is already finished.');
    if (bytes.byteLength === 0) throw new SessionInputError('The chunk was empty.');
    const dir = recordingDir(id);
    mkdirSync(dir, { recursive: true });
    const expected = chunkSeqs(id).length;
    if (seq < expected) {
        const landed = readFileSync(join(dir, `chunk-${seq}`));
        if (landed.byteLength === bytes.byteLength && Buffer.compare(landed, bytes) === 0) return expected;
    }
    if (seq !== expected) throw new ChunkOrderError(expected);
    writeFileSync(join(dir, `chunk-${seq}`), bytes);
    appendFileSync(audioFile(session), bytes);
    return expected + 1;
};

/** Makes audio.<ext> exactly the concatenation of chunks 0..count-1 (heals a crash between a
    chunk's write and its append). Returns the file's path. */
const assembleAudio = (session: SessionRow, count: number): string => {
    const dir = recordingDir(session.id);
    const file = audioFile(session);
    const paths = Array.from({ length: count }, (_, i) => join(dir, `chunk-${i}`));
    const expected_size = paths.reduce((sum, p) => sum + statSync(p).size, 0);
    if (!existsSync(file) || statSync(file).size !== expected_size) writeFileSync(file, Buffer.concat(paths.map((p) => readFileSync(p))));
    return file;
};

/** Verifies all `chunk_count` chunks landed, finalises the audio file, marks the session `uploaded`
    and starts processing. Calling it again on an already-finalised recording is a no-op. */
export const finalizeRecording = (id: number, chunk_count: number): SessionRow => {
    const session = need(id);
    if (session.status !== 'recording') {
        if (session.source === 'recording' && session.audio_path) return session;
        throw new SessionStateError('This session is not a recording in progress.');
    }
    const seqs = chunkSeqs(id);
    if (seqs.length === 0) throw new SessionInputError('Nothing was recorded.');
    if (seqs.length !== chunk_count) throw new ChunkCountError(seqs.length, chunk_count);
    const audio_path = assembleAudio(session, chunk_count);
    for (const seq of seqs) rmSync(join(recordingDir(id), `chunk-${seq}`), { force: true });
    const row = repo_sessions.updateSession(id, { status: 'uploaded', audio_path, error: null });
    if (!row) throw new SessionNotFoundError(id);
    void processSession(id);
    return row;
};
