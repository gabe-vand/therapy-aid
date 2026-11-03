// Reading and editing sessions: the list, the full record (with what the session did to problems
// joined in), PATCH and DELETE. Intake lives in notes.ts / recordings.ts, processing in pipeline.ts.
import type { Session, SessionListItem } from '@therapy-aid/shared';
import * as repo_updates from '@/repositories/problem-updates';
import * as repo_sessions from '@/repositories/sessions';
import type { SessionRow } from '@/repositories/sessions';
import { parseSessionSummary } from '@/services/context/session-summary';
import { reindexSession, removeDocument } from '@/services/search/search';
import { removeRecordingDir } from './audio-files';
import { SessionNotFoundError } from './errors';

/** A session row as the API serves it: parsed summary, and the problem updates it made. */
export const toSession = (row: SessionRow): Session => ({
    id: row.id,
    occurred_at: row.occurred_at,
    source: row.source,
    status: row.status,
    title: row.title,
    created_at: row.created_at,
    notes: row.notes,
    transcript: row.transcript,
    summary: parseSessionSummary(row.summary_json),
    error: row.error,
    duration_sec: row.duration_sec,
    problem_updates: repo_updates.selectUpdatesForSession(row.id).map((u) => ({ problem_id: u.problem_id, problem_title: u.problem_title, body: u.body, is_new_problem: u.origin_session_id === row.id })),
});

/** Every session, newest first. */
export const listSessions = (): SessionListItem[] => repo_sessions.selectSessionList();

/** One session in full; throws SessionNotFoundError. */
export const getSession = (id: number): Session => {
    const row = repo_sessions.selectSessionById(id);
    if (!row) throw new SessionNotFoundError(id);
    return toSession(row);
};

/** Edits the date and/or title (a blank title clears it back to the summary's). Re-indexes. */
export const patchSession = (id: number, patch: { occurred_at?: string; title?: string | null }): Session => {
    const current = repo_sessions.selectSessionById(id);
    if (!current) throw new SessionNotFoundError(id);
    const title = patch.title === undefined ? undefined : patch.title?.trim() || parseSessionSummary(current.summary_json)?.title || null;
    const row = repo_sessions.updateSession(id, { ...(patch.occurred_at ? { occurred_at: patch.occurred_at } : {}), ...(title !== undefined ? { title } : {}) });
    if (!row) throw new SessionNotFoundError(id);
    reindexSession(row);
    return toSession(row);
};

/** Deletes the session, its search entry and its audio folder. Its problem updates stay (the FK
    nulls their session_id), so the problem timelines keep their history. */
export const removeSession = (id: number): void => {
    if (!repo_sessions.selectSessionById(id)) throw new SessionNotFoundError(id);
    removeDocument('session', id);
    repo_sessions.deleteSession(id);
    removeRecordingDir(id);
};
