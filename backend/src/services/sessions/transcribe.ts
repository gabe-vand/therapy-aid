// Pipeline step 1 for recordings: send the assembled audio to Deepgram (streamed from disk, never
// loaded into memory), store the speaker-labelled transcript and the duration. The audio file is
// never touched on failure, so Retry works once the problem (usually a missing DEEPGRAM_API_KEY)
// is fixed.
import { existsSync } from 'node:fs';
import type { SessionRow } from '@/repositories/sessions';
import * as repo_sessions from '@/repositories/sessions';
import * as svc_deepgram from '@/services/common/svc-deepgram';
import { reindexSession } from '@/services/search/search';
import { partialAudioPath } from './audio-files';
import { buildTranscript } from './transcript-format';

/** Transcribes a recording session and stores the result. Returns the updated row; throws
    TranscriptionError (human message) when there is nothing to transcribe or Deepgram fails. */
export const transcribeSession = async (session: SessionRow): Promise<SessionRow> => {
    const path = session.audio_path ?? partialAudioPath(session);
    if (!path || !existsSync(path)) throw new svc_deepgram.TranscriptionError('The audio for this recording is missing, so it cannot be transcribed.');

    const { utterances, duration_sec } = await svc_deepgram.transcribeDiarized(Bun.file(path), session.audio_mime ?? 'application/octet-stream');
    if (utterances.length === 0) throw new svc_deepgram.TranscriptionError('No speech was found in the recording.');

    const row = repo_sessions.updateSession(session.id, { transcript: buildTranscript(utterances), duration_sec, audio_path: path });
    if (!row) throw new Error('The session was deleted while it was being transcribed.');
    reindexSession(row);
    return row;
};
