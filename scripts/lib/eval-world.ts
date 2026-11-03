// The model eval's stand-in for the database: the rows a real run would have written, kept in plain
// arrays, and rendered into prompts by the SAME pack-section functions the API uses — so a model is
// graded on the prompts it would really see, without a server, a database file or the HTTP layer.
// Each builder here mirrors one in backend/src/services/context/context-pack.ts (same sections,
// same order, same budget); only the row source differs. Pure: no I/O, no clock.
import type { FocusSnapshotRow } from '../../backend/src/repositories/focus';
import type { JournalEntryRow } from '../../backend/src/repositories/journal';
import type { ProblemUpdateWithSession } from '../../backend/src/repositories/problem-updates';
import type { ProblemRow } from '../../backend/src/repositories/problems';
import type { SessionSummaryRow } from '../../backend/src/repositories/sessions';
import { fitSessions, PACK_BUDGET_TOKENS, PACK_JOURNAL_ENTRIES, SUMMARIZATION_SESSIONS } from '../../backend/src/services/context/context-pack';
import { estimateTokens } from '../../backend/src/services/context/format';
import { renderFocus, renderJournal, renderProblems, renderProblemsForMapping, renderProfile, renderSessionFull, renderSessionLine } from '../../backend/src/services/context/pack-sections';
import type { clampSummary } from '../../backend/src/services/sessions/summarize';
import { occurredAt, type DatedEntry } from './seed-parse';

export type Summary = ReturnType<typeof clampSummary>;

/** A therapy session as the eval holds it: the summary row plus the pasted notes it came from. */
export interface EvalSession extends SessionSummaryRow {
    notes: string;
}

export interface World {
    profile: string;
    sessions: EvalSession[];
    problems: ProblemRow[];
    updates: ProblemUpdateWithSession[];
    journal: JournalEntryRow[];
    focus: FocusSnapshotRow | null;
}

export interface Seed {
    profile: string;
    notes: DatedEntry[];
    journal: DatedEntry[];
}

/** A fresh world: every note becomes a session (ids 1..n, oldest first) awaiting its summary;
    every journal entry is a row. Nothing is "ready" until setSummary runs. */
export const createWorld = (seed: Seed): World => ({
    profile: seed.profile,
    sessions: seed.notes.map((n, i) => ({ id: i + 1, occurred_at: occurredAt(n.date), title: null, summary_json: null, notes: n.body })),
    problems: [],
    updates: [],
    journal: seed.journal.map((e, i) => {
        const at = occurredAt(e.date);
        return { id: i + 1, occurred_at: at, body: e.body, created_at: at, updated_at: at };
    }),
    focus: null,
});

/** Stores a session's summary, which makes it "ready" (in the pack, in recent sessions). */
export const setSummary = (world: World, session_id: number, summary: Summary): void => {
    const session = world.sessions.find((s) => s.id === session_id);
    if (!session) throw new Error(`no session #${session_id}`);
    session.title = summary.title;
    session.summary_json = JSON.stringify(summary);
};

const newestFirst = <T extends { id: number }>(rows: T[], at: (row: T) => string): T[] => [...rows].sort((a, b) => at(b).localeCompare(at(a)) || b.id - a.id);

/** Ready sessions, newest first — selectReadySessionSummaries over the world. */
export const readySessions = (world: World, opts: { before?: string; exclude_id?: number; limit?: number } = {}): EvalSession[] => {
    const rows = newestFirst(
        world.sessions.filter((s) => s.summary_json !== null && (!opts.before || s.occurred_at < opts.before) && s.id !== opts.exclude_id),
        (s) => s.occurred_at,
    );
    return opts.limit !== undefined ? rows.slice(0, opts.limit) : rows;
};

/** Problems with one of `statuses`, by id — selectProblemsByStatus over the world. */
export const problemsByStatus = (world: World, statuses: ProblemRow['status'][]): ProblemRow[] => world.problems.filter((p) => statuses.includes(p.status)).sort((a, b) => a.id - b.id);

/** Journal entries, newest first, capped at `limit`. */
export const newestJournal = (world: World, limit?: number): JournalEntryRow[] => newestFirst(world.journal, (e) => e.occurred_at).slice(0, limit);

const updatesFor = (world: World, problems: ProblemRow[], per_problem: number): Map<number, ProblemUpdateWithSession[]> =>
    new Map(
        problems.map((p) => [
            p.id,
            newestFirst(
                world.updates.filter((u) => u.problem_id === p.id),
                (u) => u.created_at,
            ).slice(0, per_problem),
        ]),
    );

/** buildSummarizationContext: profile, every non-discarded problem, the last 3 ready sessions
    before this one. */
export const summarizationContext = (world: World, session: EvalSession): string => {
    const problems = problemsByStatus(world, ['active', 'resolved']);
    const recent = readySessions(world, { before: session.occurred_at, exclude_id: session.id, limit: SUMMARIZATION_SESSIONS });
    const sessions_text = recent.length ? recent.map(renderSessionFull).join('\n\n') : '(No earlier sessions.)';
    return [renderProfile(world.profile), renderProblemsForMapping(problems, updatesFor(world, problems, 1)), `# Recent sessions (newest first)\n\n${sessions_text}`].join('\n\n') + '\n';
};

/** buildProblemMappingContext: the problem list with ids. */
export const problemMappingContext = (world: World): string => {
    const problems = problemsByStatus(world, ['active', 'resolved']);
    return renderProblemsForMapping(problems, updatesFor(world, problems, 1)) + '\n';
};

/** buildContextPack: About Gabe, focus, problems, sessions (budgeted), recent journal. */
export const contextPack = (world: World, budget: number = PACK_BUDGET_TOKENS): string => {
    const active = problemsByStatus(world, ['active']);
    const resolved = problemsByStatus(world, ['resolved']);
    const fixed = [renderProfile(world.profile), renderFocus(world.focus), renderProblems(active, resolved, updatesFor(world, active, 2)), renderJournal(newestJournal(world, PACK_JOURNAL_ENTRIES))];
    const sessions = readySessions(world);
    const fixed_tokens = estimateTokens(fixed.join('\n\n')) + 2;
    const sessions_text = fitSessions(sessions.map(renderSessionFull), sessions.map(renderSessionLine), Math.max(0, budget - fixed_tokens));
    return [fixed[0], fixed[1], fixed[2], sessions_text, fixed[3]].join('\n\n') + '\n';
};
