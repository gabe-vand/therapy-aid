// Speech-to-text for session recordings: Deepgram's prerecorded endpoint with speaker
// diarization, over plain fetch (no SDK — one POST). An unset key is a clean, human failure,
// never a crash: the audio stays on disk and Retry works once DEEPGRAM_API_KEY is set.
import { app_env } from './svc-env';

const LISTEN_URL = 'https://api.deepgram.com/v1/listen?model=nova-3&language=en-US&smart_format=true&punctuate=true&diarize=true&utterances=true';
// A 60-minute session is ~30–60 MB from a phone; Deepgram takes a while on that.
const TIMEOUT_MS = 10 * 60 * 1000;

/** Base for every transcription failure; `message` is safe to show (becomes a session's error). */
export class TranscriptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

export class TranscriptionNotConfiguredError extends TranscriptionError {
    constructor() {
        super('Transcription is not configured (DEEPGRAM_API_KEY)');
    }
}

export interface Utterance {
    // Deepgram's diarized speaker index (0, 1, …) — which one is the therapist is inferred later.
    speaker: number;
    transcript: string;
    // Seconds from the start of the audio.
    start: number;
    end: number;
}

export interface DiarizedTranscript {
    utterances: Utterance[];
    duration_sec: number | null;
}

interface DeepgramResponse {
    metadata?: { duration?: number };
    results?: { utterances?: { speaker?: number; transcript?: string; start?: number; end?: number }[] };
}

/** True when DEEPGRAM_API_KEY is set. */
export const isTranscriptionConfigured = (): boolean => app_env.deepgram_api_key.length > 0;

/** Transcribes one audio file with speaker labels. `audio` can be a Bun.file(path) (streamed,
    never loaded into memory), a Blob or raw bytes. Throws TranscriptionError on any failure. */
export const transcribeDiarized = async (audio: Blob | Uint8Array | ArrayBuffer, mime: string): Promise<DiarizedTranscript> => {
    if (!isTranscriptionConfigured()) throw new TranscriptionNotConfiguredError();

    let res: Response;
    try {
        res = await fetch(LISTEN_URL, {
            method: 'POST',
            headers: { Authorization: `Token ${app_env.deepgram_api_key}`, 'Content-Type': mime },
            body: audio,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch (e) {
        console.error('[deepgram] request failed', e);
        throw new TranscriptionError('Could not reach the transcription service. Try again.');
    }
    if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 300);
        console.error(`[deepgram] HTTP ${res.status}: ${detail}`);
        throw new TranscriptionError(res.status === 401 || res.status === 403 ? 'Transcription was refused: check DEEPGRAM_API_KEY.' : `Transcription failed (HTTP ${res.status}). Try again.`);
    }

    const body = (await res.json()) as DeepgramResponse;
    const utterances = (body.results?.utterances ?? [])
        .filter((u) => (u.transcript ?? '').trim().length > 0)
        .map((u) => ({ speaker: u.speaker ?? 0, transcript: (u.transcript ?? '').trim(), start: u.start ?? 0, end: u.end ?? 0 }));
    return { utterances, duration_sec: body.metadata?.duration ?? null };
};

/** `[mm:ss] Speaker N: …`, one line per utterance — the transcript text the summarizer reads. */
export const formatUtterances = (utterances: Utterance[]): string =>
    utterances
        .map((u) => {
            const total = Math.max(0, Math.floor(u.start));
            const mm = String(Math.floor(total / 60)).padStart(2, '0');
            const ss = String(total % 60).padStart(2, '0');
            return `[${mm}:${ss}] Speaker ${u.speaker}: ${u.transcript}`;
        })
        .join('\n');
