// Queries on the search_index FTS5 virtual table. Raw SQL (Drizzle has no FTS5 support), always
// with bound parameters. The MATCH expression arrives already sanitized by services/search.
import { sqlite } from '@/services/common/svc-db';

export type SearchKind = 'session' | 'journal';

export interface SearchDocument {
    kind: SearchKind;
    ref_id: number;
    occurred_at: string;
    title: string;
    body: string;
}

export interface SearchRow {
    kind: SearchKind;
    ref_id: number;
    occurred_at: string;
    title: string;
    snippet: string;
}

/** Replaces the one row for (kind, ref_id) — delete + insert in one transaction. */
export const replaceSearchDocument = (doc: SearchDocument): void => {
    sqlite.transaction(() => {
        sqlite.query('delete from search_index where kind = ? and ref_id = ?').run(doc.kind, doc.ref_id);
        sqlite.query('insert into search_index (kind, ref_id, occurred_at, title, body) values (?, ?, ?, ?, ?)').run(doc.kind, doc.ref_id, doc.occurred_at, doc.title, doc.body);
    })();
};

/** Removes the row for (kind, ref_id), if any. */
export const deleteSearchDocument = (kind: SearchKind, ref_id: number): void => {
    sqlite.query('delete from search_index where kind = ? and ref_id = ?').run(kind, ref_id);
};

/** Best matches first (bm25; title hits weigh 3x body hits), with a ~24-token body snippet
    whose matched terms are wrapped in [ ]. `kind` null searches both kinds. */
export const searchIndex = (match: string, kind: SearchKind | null, limit: number): SearchRow[] => {
    const rows = sqlite
        .query(
            `select kind, ref_id, occurred_at, title, snippet(search_index, 4, '[', ']', '…', 24) as snippet
             from search_index
             where search_index match ?1 and (?2 is null or kind = ?2)
             order by bm25(search_index, 0, 0, 0, 3.0, 1.0), occurred_at desc
             limit ?3`,
        )
        .all(match, kind, limit) as { kind: SearchKind; ref_id: number | string; occurred_at: string; title: string; snippet: string }[];
    // UNINDEXED columns keep whatever affinity was bound; normalise ref_id to a number.
    return rows.map((row) => ({ ...row, ref_id: Number(row.ref_id) }));
};

/** How many documents are indexed. */
export const countSearchDocuments = (): number => (sqlite.query('select count(*) as n from search_index').get() as { n: number }).n;

/** Empties the index (before a full rebuild). */
export const clearSearchIndex = (): void => {
    sqlite.query('delete from search_index').run();
};

/** Runs `fn` in one transaction (a rebuild writes every row at once, or none). */
export const inSearchTransaction = (fn: () => void): void => {
    sqlite.transaction(fn)();
};
