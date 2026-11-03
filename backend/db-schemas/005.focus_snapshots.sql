-- Focus snapshots: the "what to focus on now" banner. Append-only — the newest row is current,
-- older rows are history. content_json is { headline, items[] } (FocusSnapshot minus ids).
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists focus_snapshots (
    id integer primary key autoincrement,
    -- The session whose processing triggered it; null for an on-demand regenerate.
    session_id integer references sessions (id) on delete set null,
    content_json text not null,
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists focus_snapshots_created_at on focus_snapshots (created_at);
