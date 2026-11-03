// Turns Deepgram's diarized utterances into the transcript text the summarizer reads. Deepgram
// splits at every pause, so one speaker's turn arrives as many short utterances; merging
// consecutive same-speaker ones keeps the text readable and the token count down. The line
// format itself ("[mm:ss] Speaker N: …") lives in svc-deepgram.
import { formatUtterances, type Utterance } from '@/services/common/svc-deepgram';

/** Merges consecutive utterances by the same speaker into one turn (keeping the first start). */
export const mergeTurns = (utterances: Utterance[]): Utterance[] => {
    const turns: Utterance[] = [];
    for (const u of utterances) {
        const last = turns[turns.length - 1];
        if (last && last.speaker === u.speaker) {
            last.transcript = `${last.transcript} ${u.transcript}`;
            last.end = u.end;
        } else {
            turns.push({ ...u });
        }
    }
    return turns;
};

/** The stored transcript: `[mm:ss] Speaker N: …` per speaker turn. */
export const buildTranscript = (utterances: Utterance[]): string => formatUtterances(mergeTurns(utterances));
