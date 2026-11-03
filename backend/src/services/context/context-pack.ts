// THE grounding text for chat, focus and insights: everything the model should know about Gabe's
// therapy, as one markdown document. It is deterministic (same rows ⇒ byte-identical text, no
// clock) because it rides in a cache_control'd system block — a stable pack is what makes repeat
// calls ~90% cheaper. It is budgeted (~30k tokens): when the sessions don't all fit, the OLDEST
// degrade to one line each; depth on old material comes from search, not from the pack.
import * as repo_focus from '@/repositories/focus';
import * as repo_journal from '@/repositories/journal';
import * as repo_updates from '@/repositories/problem-updates';
import type { ProblemUpdateWithSession } from '@/repositories/problem-updates';
import * as repo_problems from '@/repositories/problems';
import type { ProblemRow } from '@/repositories/problems';
import * as repo_sessions from '@/repositories/sessions';
import { getProfile } from '@/services/settings/settings';
import { estimateTokens } from './format';
import { renderFocus, renderJournal, renderProblems, renderProblemsForMapping, renderProfile, renderSessionFull, renderSessionLine } from './pack-sections';

export const PACK_BUDGET_TOKENS = 30_000;
export const PACK_JOURNAL_ENTRIES = 8;
export const SUMMARIZATION_SESSIONS = 3;

const SESSIONS_HEADING = '# Therapy sessions (newest first)';

/** Newest notes per problem (newest first), `per_problem` each. */
const updatesFor = (problems: ProblemRow[], per_problem: number): Map<number, ProblemUpdateWithSession[]> =>
    new Map(problems.map((p) => [p.id, repo_updates.selectUpdatesForProblem(p.id, per_problem)]));

/** Fits the sessions section into `budget_tokens` (what is left after the fixed sections):
    full renders, newest first; oldest degrade to one line until it fits; if even the one-liners
    don't fit, the oldest are dropped with a note saying how many. */
export const fitSessions = (full: string[], lines: string[], budget_tokens: number): string => {
    const render = (kept_full: number, kept_lines: number, omitted: number): string => {
        const parts = [SESSIONS_HEADING, ...full.slice(0, kept_full)];
        const condensed = lines.slice(kept_full, kept_full + kept_lines);
        if (condensed.length) parts.push(`## Older sessions (condensed — search for details)\n\n${condensed.join('\n')}`);
        if (omitted) parts.push(`(${omitted} older session${omitted === 1 ? '' : 's'} omitted — use search to find them.)`);
        return parts.join('\n\n');
    };
    if (full.length === 0) return `${SESSIONS_HEADING}\n\n(No processed sessions yet.)`;

    for (let kept_full = full.length; kept_full >= 0; kept_full--) {
        const text = render(kept_full, full.length - kept_full, 0);
        if (estimateTokens(text) <= budget_tokens) return text;
    }
    for (let kept_lines = full.length - 1; kept_lines >= 0; kept_lines--) {
        const text = render(0, kept_lines, full.length - kept_lines);
        if (estimateTokens(text) <= budget_tokens || kept_lines === 0) return text;
    }
    return render(0, 0, full.length);
};

/** The full context pack. Sections in order: About Gabe, Current focus, Problems, Therapy
    sessions (ready only, newest first), Recent journal entries (last 8, ≤ 700 words each).
    `exclude_entry_id` leaves one journal entry out: an insight call saves its draft to the entry
    first, and the draft rides in the user message, so keeping it out of the cached system block
    stops every click from rewriting the cache. Not passed ⇒ the pack is unchanged. */
export const buildContextPack = (opts: { budget_tokens?: number; exclude_entry_id?: number } = {}): string => {
    const budget = opts.budget_tokens ?? PACK_BUDGET_TOKENS;
    const active = repo_problems.selectProblemsByStatus(['active']);
    const resolved = repo_problems.selectProblemsByStatus(['resolved']);

    const fixed = [
        renderProfile(getProfile().profile),
        renderFocus(repo_focus.selectLatestFocusSnapshot()),
        renderProblems(active, resolved, updatesFor(active, 2)),
        renderJournal(repo_journal.selectJournalEntries(PACK_JOURNAL_ENTRIES, opts.exclude_entry_id)),
    ];
    const sessions = repo_sessions.selectReadySessionSummaries();
    const fixed_tokens = estimateTokens(fixed.join('\n\n')) + 2;
    const sessions_text = fitSessions(sessions.map(renderSessionFull), sessions.map(renderSessionLine), Math.max(0, budget - fixed_tokens));

    return [fixed[0], fixed[1], fixed[2], sessions_text, fixed[3]].join('\n\n') + '\n';
};

/** What the session summarizer needs to see the session in context: the profile, every
    non-discarded problem with its id, and the last 3 ready sessions in full. `before` (the
    session's occurred_at) and `exclude_session_id` keep the session itself — and anything after
    it, when seeding history in order — out of "recent sessions". */
export const buildSummarizationContext = (opts: { before?: string; exclude_session_id?: number } = {}): string => {
    const problems = repo_problems.selectProblemsByStatus(['active', 'resolved']);
    const recent = repo_sessions.selectReadySessionSummaries({ limit: SUMMARIZATION_SESSIONS, before: opts.before, exclude_id: opts.exclude_session_id });
    const sessions_text = recent.length ? recent.map(renderSessionFull).join('\n\n') : '(No earlier sessions.)';
    return [renderProfile(getProfile().profile), renderProblemsForMapping(problems, updatesFor(problems, 1)), `# Recent sessions (newest first)\n\n${sessions_text}`].join('\n\n') + '\n';
};

/** Just the problem list with ids — the map_problems call's view of "what already exists". */
export const buildProblemMappingContext = (): string => {
    const problems = repo_problems.selectProblemsByStatus(['active', 'resolved']);
    return renderProblemsForMapping(problems, updatesFor(problems, 1)) + '\n';
};
