// Problems: the big-picture threads that persist across sessions ("key problems identified").

export type ProblemStatus = 'active' | 'resolved' | 'discarded';

/** GET /problems — one problem with its derived fields. */
export interface Problem {
    id: number;
    title: string;
    description: string;
    status: ProblemStatus;
    created_at: string;
    updated_at: string;
    last_discussed_at: string | null;
    last_reviewed_at: string | null;
    origin_session_id: number | null;
    // Active and untouched (discussed / reviewed / created) for 30 days.
    is_stale: boolean;
    update_count: number;
    // Body of the newest progress note, if any.
    latest_update: string | null;
}

/** One progress note on a problem — from a session (source ai) or typed by Gabe (manual). */
export interface ProblemUpdate {
    id: number;
    problem_id: number;
    session_id: number | null;
    session_title: string | null;
    body: string;
    source: 'ai' | 'manual';
    created_at: string;
}

/** GET /problems/:id — a problem and its timeline, newest first. */
export interface ProblemDetail extends Problem {
    updates: ProblemUpdate[];
}
