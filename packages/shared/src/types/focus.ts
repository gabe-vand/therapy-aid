// Focus: the "what you should be focusing on right now" banner, regenerated after every session.

export interface FocusItem {
    // ≤ 8 words.
    title: string;
    // 1–2 sentences grounded in a specific session or problem.
    why: string;
    // One concrete thing to do this week.
    action: string;
    problem_id: number | null;
}

/** GET /focus — the latest snapshot (1–3 items). */
export interface FocusSnapshot {
    id: number;
    session_id: number | null;
    created_at: string;
    headline: string;
    items: FocusItem[];
}
