// GET /dashboard, computed from rows every time (no AI, no cache; a handful of small queries).
// Sessions: how many, the last one with David's advice, the typical gap. Threads: every active
// problem against the last 8 ready sessions (did that session write a note on it?) plus how often
// the journal has touched it lately. Journal: counts, streak, and the problems it has been about.
import type { Dashboard, DashboardThread } from '@therapy-aid/shared';
import * as repo_insights from '@/repositories/journal-insights';
import * as repo_journal from '@/repositories/journal';
import * as repo_pairs from '@/repositories/problem-updates-by-session';
import * as repo_updates from '@/repositories/problem-updates';
import * as repo_problems from '@/repositories/problems';
import * as repo_sessions from '@/repositories/sessions';
import { parseSessionSummary } from '@/services/context/session-summary';
import { isStale } from '@/services/problems/staleness';
import { dayKey, daysAgo, streakDays, typicalGapDays, wordCount } from './rhythm';

export const AXIS_SESSIONS = 8;
export const THEME_COUNT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const activity = (p: { last_discussed_at: string | null; created_at: string }): string => p.last_discussed_at ?? p.created_at;

export const buildDashboard = (now: number = Date.now()): Dashboard => {
    const since_30d = new Date(now - 30 * DAY_MS).toISOString();
    const since_7d = new Date(now - 7 * DAY_MS).toISOString();

    // Sessions
    const ready = repo_sessions.selectReadySessionSummaries(); // newest first
    const axis_rows = ready.slice(0, AXIS_SESSIONS).reverse();
    const last_row = ready[0] ?? null;
    const last = last_row ? { id: last_row.id, title: last_row.title, occurred_at: last_row.occurred_at, advice: parseSessionSummary(last_row.summary_json)?.therapist_advice ?? [] } : null;

    // Threads
    const active = repo_problems.selectProblemsByStatus(['active']).sort((a, b) => activity(b).localeCompare(activity(a)) || a.id - b.id);
    const ids = active.map((p) => p.id);
    const counts = new Map(repo_updates.selectUpdateStats().map((s) => [s.problem_id, s.update_count]));
    const mentions = new Map(repo_insights.selectLinkCountsSince(since_30d, ids).map((m) => [m.problem_id, m.mentions]));
    const pairs = repo_pairs.selectProblemSessionPairs(axis_rows.map((s) => s.id));
    const touched = new Set(pairs.map((p) => `${p.problem_id}:${p.session_id}`));
    const threads: DashboardThread[] = active.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        is_stale: isStale(p, now),
        last_discussed_at: p.last_discussed_at,
        update_count: counts.get(p.id) ?? 0,
        marks: axis_rows.map((s) => touched.has(`${p.id}:${s.id}`)),
        journal_mentions: mentions.get(p.id) ?? 0,
    }));

    // Journal
    const entries = repo_journal.selectJournalEntries(); // newest first
    const today = dayKey(new Date(now));
    const themes = threads
        .filter((t) => t.journal_mentions > 0)
        .sort((a, b) => b.journal_mentions - a.journal_mentions || a.id - b.id)
        .slice(0, THEME_COUNT)
        .map((t) => ({ problem_id: t.id, title: t.title, mentions: t.journal_mentions }));

    return {
        sessions: { total: ready.length, axis: axis_rows.map((s) => ({ id: s.id, occurred_at: s.occurred_at, title: s.title })), last, typical_gap_days: typicalGapDays(ready.map((s) => s.occurred_at)) },
        threads,
        journal: {
            entries_30d: entries.filter((e) => e.occurred_at >= since_30d).length,
            words_7d: entries.filter((e) => e.occurred_at >= since_7d).reduce((n, e) => n + wordCount(e.body), 0),
            streak_days: streakDays(
                entries.map((e) => dayKey(e.occurred_at)),
                today,
            ),
            last_entry: entries[0] ? { id: entries[0].id, occurred_at: entries[0].occurred_at } : null,
            themes,
        },
        since_last_session: last ? { entries: entries.filter((e) => e.occurred_at > last.occurred_at).length, notes: repo_insights.countMarginNotesSince(last.occurred_at) } : null,
    };
};

export { daysAgo };
