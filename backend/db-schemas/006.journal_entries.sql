-- Journal entries. occurred_at is the day the entry is about (editable); the body autosaves.
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists journal_entries (
    id integer primary key autoincrement,
    occurred_at text not null,
    body text not null default '',
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists journal_entries_occurred_at on journal_entries (occurred_at);
