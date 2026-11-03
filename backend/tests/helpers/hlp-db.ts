// Test database helpers. `bun test` runs every file in ONE process, so the in-memory SQLite is
// shared across files: call resetDatabase() in beforeEach to start each test from empty tables.
// The seed* factories insert through the real repositories with sensible defaults.
import type { SessionSummary } from '@therapy-aid/shared';
import * as repo_focus from '@/repositories/focus';
import * as repo_journal from '@/repositories/journal';
import * as repo_updates from '@/repositories/problem-updates';
import * as repo_problems from '@/repositories/problems';
import * as repo_sessions from '@/repositories/sessions';
import { sqlite } from '@/services/common/svc-db';
import { dbMigrate } from '@/services/common/svc-migrate';

// Children before parents, so foreign keys never block the wipe.
const TABLES = ['search_index', 'chat_messages', 'chat_threads', 'journal_insights', 'journal_entries', 'focus_snapshots', 'problem_updates', 'problems', 'sessions', 'app_settings'];

/** Applies the schema (idempotent) and empties every app table. */
export const resetDatabase = (): void => {
    dbMigrate();
    for (const table of TABLES) sqlite.exec(`delete from ${table}`);
};

/** A SessionSummary with overridable fields. */
export const summary = (over: Partial<SessionSummary> = {}): SessionSummary => ({
    title: 'Racing mind, morning structure',
    overview: 'We talked about the racing mind at night and how mornings fall apart without structure.',
    key_points: ['Racing thoughts peak after 11pm', 'Mornings have no anchor'],
    therapist_advice: ['Write a worry list before bed', 'Same wake time every day'],
    ...over,
});

/** A ready notes session (summary included) unless overridden. */
export const seedSession = (over: Partial<repo_sessions.NewSessionRow> & { summary?: SessionSummary | null } = {}): repo_sessions.SessionRow => {
    const { summary: s, ...rest } = over;
    const sum = s === undefined ? summary() : s;
    return repo_sessions.insertSession({
        occurred_at: '2026-09-11T16:00:00.000Z',
        source: 'notes',
        status: 'ready',
        notes: 'Raw notes from the session.',
        title: sum?.title ?? null,
        summary_json: sum ? JSON.stringify(sum) : null,
        ...rest,
    });
};

/** An active problem unless overridden. */
export const seedProblem = (over: Partial<repo_problems.NewProblemRow> = {}): repo_problems.ProblemRow =>
    repo_problems.insertProblem({ title: 'Racing mind at night', description: 'Thoughts speed up when trying to sleep.', ...over });

/** One progress note on a problem. */
export const seedUpdate = (problem_id: number, over: Partial<repo_updates.NewProblemUpdateRow> & { created_at?: string } = {}): repo_updates.ProblemUpdateRow =>
    repo_updates.insertProblemUpdate({ problem_id, body: 'Tried the worry list twice.', source: 'ai', ...over });

/** One journal entry. */
export const seedJournal = (over: { occurred_at?: string; body?: string } = {}): repo_journal.JournalEntryRow =>
    repo_journal.insertJournalEntry({ occurred_at: '2026-10-13T16:00:00.000Z', body: 'Slept badly again.\nThe list helped a bit.', ...over });

/** One focus snapshot. */
export const seedFocus = (content: { headline: string; items: unknown[] }, session_id: number | null = null): repo_focus.FocusSnapshotRow =>
    repo_focus.insertFocusSnapshot({ session_id, content_json: JSON.stringify(content) });
