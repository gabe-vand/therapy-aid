-- Full-text index over sessions and journal entries (SQLite FTS5): the retrieval behind chat's
-- "possibly relevant excerpts" and its search_notes tool. One row per document; services delete +
-- insert on every write (services/search), and rebuildSearchIndex() refills it at boot if empty.
-- kind is 'session' or 'journal'. Porter stemming, so "panicking" finds "panic".
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create virtual table if not exists search_index using fts5(
    kind unindexed,
    ref_id unindexed,
    occurred_at unindexed,
    title,
    body,
    tokenize = 'porter unicode61'
);
