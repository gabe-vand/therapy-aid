// Therapy sessions: the record both intake pipelines (live recording, pasted notes) converge on.

export type SessionSource = 'recording' | 'notes';

export type SessionStatus = 'recording' | 'uploaded' | 'transcribing' | 'summarizing' | 'ready' | 'failed';

/** What the summarizer (task `summarize`) produces for one session; stored as sessions.summary_json. */
export interface SessionSummary {
    // ≤ 60 chars, e.g. "Racing mind, ADHD, morning structure".
    title: string;
    // Markdown, 120–250 words: what was discussed and what mattered.
    overview: string;
    // 3–8 concrete points.
    key_points: string[];
    // David's concrete suggestions / assignments, verbatim-ish, 0–8.
    therapist_advice: string[];
}

/** GET /sessions — one row of the list, newest first. */
export interface SessionListItem {
    id: number;
    occurred_at: string;
    source: SessionSource;
    status: SessionStatus;
    title: string | null;
    created_at: string;
}

/** What one session did to a problem (a progress note, or the note that opened it). */
export interface SessionProblemUpdate {
    problem_id: number;
    problem_title: string;
    body: string;
    is_new_problem: boolean;
}

/** GET /sessions/:id — the full record. */
export interface Session extends SessionListItem {
    notes: string | null;
    transcript: string | null;
    summary: SessionSummary | null;
    error: string | null;
    duration_sec: number | null;
    problem_updates: SessionProblemUpdate[];
}
