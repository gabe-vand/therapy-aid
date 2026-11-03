// Journal entries and the notes the app writes back: margin notes (short, automatic, anchored to
// a paragraph while Gabe writes) and reflections (long, on demand, about the whole entry).

export interface JournalEntry {
    id: number;
    occurred_at: string;
    body: string;
    created_at: string;
    updated_at: string;
    // Notes of both kinds, dismissed ones excluded.
    insight_count: number;
}

/** What a note does: ties a paragraph to a thread ('connection'), repeats something David
    advised ('advice'), asks one question back ('question'), or is a long reflection on the whole
    entry ('reflection' — the on-demand kind). */
export type JournalNoteKind = 'connection' | 'advice' | 'question' | 'reflection';

export type JournalNoteSource = 'margin' | 'reflection';

/** One note on an entry (GET /journal/:id/insights). Margin notes carry an anchor (the first
    ~80 plain-text characters of the paragraph they were written about); reflections don't. */
export interface JournalInsight {
    id: number;
    entry_id: number;
    // Markdown.
    body: string;
    kind: JournalNoteKind;
    source: JournalNoteSource;
    problem_id: number | null;
    problem_title: string | null;
    session_id: number | null;
    anchor: string | null;
    dismissed_at: string | null;
    created_at: string;
}

/** POST /journal/:id/notes — what one completed paragraph produced. The classifier always runs
    (and records a journal↔problem link when confident); a note is written only when `write` was
    asked for and nothing blocks it. */
export type MarginNoteOutcome = 'written' | 'no_match' | 'duplicate' | 'capped' | 'skipped';

export interface MarginNoteResult {
    outcome: MarginNoteOutcome;
    link: { problem_id: number; problem_title: string; confidence: number } | null;
    note: JournalInsight | null;
}

/** A journal paragraph the classifier tied to a problem (shown on the problem's page). */
export interface JournalMention {
    entry_id: number;
    occurred_at: string;
    excerpt: string;
    confidence: number;
}
