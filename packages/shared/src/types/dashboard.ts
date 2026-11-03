// GET /dashboard — the numbers and small shapes Home draws: the rhythm of sessions, how each
// problem thread has moved across the last sessions, what the journal has been about. All
// computed from stored rows (no AI call), so it is cheap enough to load on every visit.

import type { ProblemStatus } from './problems';

/** One column of the thread grid: a ready session, oldest first. */
export interface DashboardSessionMark {
    id: number;
    occurred_at: string;
    title: string | null;
}

/** One active problem as a row of the thread grid. `marks[i]` is true when session `axis[i]`
    wrote a note on it. */
export interface DashboardThread {
    id: number;
    title: string;
    status: ProblemStatus;
    is_stale: boolean;
    last_discussed_at: string | null;
    update_count: number;
    marks: boolean[];
    // Journal paragraphs tied to it in the last 30 days.
    journal_mentions: number;
}

export interface DashboardTheme {
    problem_id: number;
    title: string;
    mentions: number;
}

export interface Dashboard {
    sessions: {
        total: number;
        // The sessions the thread marks refer to (up to 8, oldest first).
        axis: DashboardSessionMark[];
        last: { id: number; title: string | null; occurred_at: string; advice: string[] } | null;
        // Median days between the last sessions, or null with fewer than 2.
        typical_gap_days: number | null;
    };
    threads: DashboardThread[];
    journal: {
        entries_30d: number;
        words_7d: number;
        // Consecutive days (ending today or yesterday) with an entry.
        streak_days: number;
        last_entry: { id: number; occurred_at: string } | null;
        // Problems the journal touched most in the last 30 days, top 5.
        themes: DashboardTheme[];
    };
    // Null before the first session.
    since_last_session: { entries: number; notes: number } | null;
}
