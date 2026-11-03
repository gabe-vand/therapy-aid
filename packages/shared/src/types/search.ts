// GET /search?q= — full-text hits over sessions and journal entries (the command palette).

export type SearchResultKind = 'session' | 'journal';

export interface SearchResult {
    kind: SearchResultKind;
    ref_id: number;
    occurred_at: string;
    title: string;
    // ~24 words around the match; matched terms wrapped in [ ].
    snippet: string;
}
