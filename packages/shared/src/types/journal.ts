// Journal entries and the on-demand "I have an idea…" insights generated from a draft.

export interface JournalEntry {
    id: number;
    occurred_at: string;
    body: string;
    created_at: string;
    updated_at: string;
    insight_count: number;
}

export interface JournalInsight {
    id: number;
    entry_id: number;
    // Markdown.
    body: string;
    created_at: string;
}
