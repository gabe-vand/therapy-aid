// The session processing state machine: uploaded → transcribing (recordings only) → summarizing
// → ready, or failed with a readable error. processSession NEVER throws — every failure lands on
// the row, because nobody awaits a background job. It is also resumable: a stored transcript skips
// transcription, a stored summary skips the summarize call, so Retry (and boot recovery) re-enter
// at the step that actually failed. Sessions run strictly one at a time through a promise chain,
// so each session's problem mapping sees the problems the previous one just wrote — that is what
// makes seeding six notes in order correct.
import type { SessionRow } from '@/repositories/sessions';
import * as repo_sessions from '@/repositories/sessions';
import * as repo_updates from '@/repositories/problem-updates';
import { AiError } from '@/services/common/svc-claude';
import { TranscriptionError } from '@/services/common/svc-deepgram';
import { parseSessionSummary } from '@/services/context/session-summary';
import { regenerateFocus } from '@/services/focus/focus';
import { reindexSession } from '@/services/search/search';
import { applyProblemUpdates } from './apply-problems';
import { SessionNotFoundError, SessionStateError } from './errors';
import { mapProblems } from './map-problems';
import { summarizeSession } from './summarize';
import { transcribeSession } from './transcribe';

const RUNNABLE = new Set(['uploaded', 'transcribing', 'summarizing', 'failed']);

/** Thrown inside a run when the row vanished (the session was deleted mid-processing). */
class SessionGoneError extends Error {}

/** The message stored in sessions.error (and served to the SPA): readable, and never an SDK JSON
    dump. An unrecognised error gets a fixed sentence — its own message can carry file paths or
    SQLite text, and runPipeline has already logged it in full. */
export const describeFailure = (e: unknown): string => {
    if (e instanceof AiError || e instanceof TranscriptionError) return e.message;
    const status = (e as { status?: unknown } | null)?.status;
    if (typeof status === 'number') {
        return status === 429 || status >= 500 ? `The AI service is busy or unavailable right now (HTTP ${status}). Press Retry in a minute.` : `The AI service rejected the request (HTTP ${status}).`;
    }
    return 'Processing failed unexpectedly. Press Retry; if it keeps failing, check the API logs.';
};

/** updateSession that throws SessionGoneError when the row no longer exists. */
const save = (id: number, patch: repo_sessions.SessionPatch): SessionRow => {
    const row = repo_sessions.updateSession(id, patch);
    if (!row) throw new SessionGoneError();
    return row;
};

/** The row as it is NOW. The title and date can be edited (PATCH) while an AI call is in flight,
    so anything written or read after an await starts from a fresh read, not the captured row. */
const reread = (id: number): SessionRow => {
    const row = repo_sessions.selectSessionById(id);
    if (!row) throw new SessionGoneError();
    return row;
};

/** Runs whatever steps remain for one session. Rejects only through its caller's catch. */
const runSteps = async (initial: SessionRow): Promise<void> => {
    let session = initial;
    if (session.source === 'recording' && !session.transcript) {
        session = save(session.id, { status: 'transcribing', error: null });
        session = await transcribeSession(session);
    }

    session = save(session.id, { status: 'summarizing', error: null });
    let summary = parseSessionSummary(session.summary_json);
    if (!summary?.overview) {
        summary = await summarizeSession(session);
        // A title typed while summarize ran wins over the AI's.
        session = save(session.id, { summary_json: JSON.stringify(summary), title: reread(session.id).title ?? summary.title });
        reindexSession(session);
    }

    // Clear this session's notes from an earlier run BEFORE mapping (the mapper sees the latest note
    // per problem, so stale ones would mislead it) — and so applyProblemUpdates only ever adds.
    repo_updates.deleteUpdatesForSession(session.id);
    const extraction = await mapProblems(session.occurred_at, summary);
    session = reread(session.id); // a date edited during the mapping call dates the notes
    const applied = applyProblemUpdates(session, extraction);
    console.log(`[sessions] session ${session.id}: ${applied.updated} problem(s) updated, ${applied.created} opened, ${applied.resolved} resolved, ${applied.skipped} skipped`);

    session = save(session.id, { status: 'ready', error: null });
    reindexSession(session);
};

/** One full run, including the best-effort focus refresh. Never rejects. */
const runPipeline = async (id: number): Promise<void> => {
    const session = repo_sessions.selectSessionById(id);
    if (!session) return void console.warn(`[sessions] session ${id} no longer exists; nothing to process`);
    if (!RUNNABLE.has(session.status)) return;

    try {
        await runSteps(session);
    } catch (e) {
        if (e instanceof SessionGoneError) return void console.warn(`[sessions] session ${id} was deleted while processing`);
        console.error(`[sessions] session ${id} failed`, e);
        repo_sessions.updateSession(id, { status: 'failed', error: describeFailure(e) });
        return;
    }

    // The session is ready; a failed focus refresh must not undo that (Home has a Refresh button).
    try {
        await regenerateFocus(id);
    } catch (e) {
        console.error(`[sessions] session ${id}: focus refresh failed`, e);
    }
};

let chain: Promise<void> = Promise.resolve();

/** Queues one session's processing (one at a time, in call order). Resolves when it is done;
    never rejects. Callers that don't care use `void processSession(id)`. */
export const processSession = (id: number): Promise<void> => {
    const run = chain.then(() => runPipeline(id)).catch((e) => console.error(`[sessions] unexpected pipeline error for session ${id}`, e));
    chain = run;
    return run;
};

/** Resolves when everything queued so far has finished (tests, graceful shutdown). */
export const pipelineIdle = (): Promise<void> => chain;

/** Re-runs a failed session from the step that failed, and returns the row (status `uploaded`). */
export const retrySession = (id: number): SessionRow => {
    const session = repo_sessions.selectSessionById(id);
    if (!session) throw new SessionNotFoundError(id);
    if (session.status !== 'failed') throw new SessionStateError('Only a failed session can be retried.');
    const row = save(id, { status: 'uploaded', error: null });
    void processSession(id);
    return row;
};
