// Focus: the "what you should be focusing on right now" banner, regenerated after every session,
// plus the per-day check-ins Gabe ticks against each item's action on Home.

export interface FocusItem {
    // ≤ 8 words.
    title: string;
    // 1–2 sentences grounded in a specific session or problem.
    why: string;
    // One concrete thing to do this week.
    action: string;
    problem_id: number | null;
}

/** One tick: "I did item N's action on this day" (day is YYYY-MM-DD in Gabe's local time). */
export interface FocusCheckin {
    item_index: number;
    day: string;
}

/** GET /focus — the latest snapshot (1–3 items) with its check-ins. */
export interface FocusSnapshot {
    id: number;
    session_id: number | null;
    created_at: string;
    headline: string;
    items: FocusItem[];
    checkins: FocusCheckin[];
}

/** PUT /focus/checkins — toggles one check-in on the current snapshot. */
export interface FocusCheckinInput {
    item_index: number;
    day: string;
    done: boolean;
}
