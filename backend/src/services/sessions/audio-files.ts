// Where a session's audio lives on disk: <recordings_dir>/<session id>/ holding chunk-<seq> files
// while recording and the assembled audio.<ext>. Path and naming rules only, so recordings.ts
// (intake) and pipeline.ts (transcription, boot recovery, delete) share them without importing
// each other.
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { SessionRow } from '@/repositories/sessions';
import { app_env } from '@/services/common/svc-env';

const CHUNK = /^chunk-(\d+)$/;

/** The mime without parameters ("audio/webm;codecs=opus" → "audio/webm"), lower-cased. */
export const baseMime = (mime: string): string => mime.split(';')[0]!.trim().toLowerCase();

/** File extension for the assembled audio. */
export const extensionFor = (mime: string): string => {
    switch (baseMime(mime)) {
        case 'audio/webm':
            return 'webm';
        case 'audio/mp4':
            return 'm4a';
        case 'audio/ogg':
            return 'ogg';
        default:
            return 'bin';
    }
};

/** The folder holding one session's audio. */
export const recordingDir = (session_id: number): string => resolve(app_env.recordings_dir, String(session_id));

/** Removes a session's whole audio folder (no error when it is already gone). */
export const removeRecordingDir = (session_id: number): void => rmSync(recordingDir(session_id), { recursive: true, force: true });

/** The assembled audio file for a session (it may not exist yet). */
export const audioFile = (session: SessionRow): string => join(recordingDir(session.id), `audio.${extensionFor(session.audio_mime ?? '')}`);

/** The chunk numbers on disk, ascending. */
export const chunkSeqs = (session_id: number): number[] => {
    const dir = recordingDir(session_id);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .map((name) => CHUNK.exec(name)?.[1])
        .filter((n): n is string => n !== undefined)
        .map(Number)
        .sort((a, b) => a - b);
};

/** The audio saved so far for a recording that never finished, or null when there is none. */
export const partialAudioPath = (session: SessionRow): string | null => {
    const file = audioFile(session);
    return existsSync(file) && statSync(file).size > 0 ? file : null;
};
