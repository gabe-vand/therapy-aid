-- "I have an idea…" insights: generated only when Gabe clicks, from the draft of one entry.
-- Kept as a history per entry; deleted with the entry.
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists journal_insights (
    id integer primary key autoincrement,
    entry_id integer not null references journal_entries (id) on delete cascade,
    -- Markdown.
    body text not null,
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists journal_insights_entry_id on journal_insights (entry_id);
