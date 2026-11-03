-- Problems: big-picture threads that persist across sessions. A problem is "stale" when it is
-- active and neither discussed (last_discussed_at), reviewed (last_reviewed_at, "Keep") nor
-- created in 30 days — computed at read time, never stored.
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists problems (
    id integer primary key autoincrement,
    title text not null,
    description text not null default '',
    status text not null default 'active' check (status in ('active', 'resolved', 'discarded')),
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_discussed_at text,
    last_reviewed_at text,
    -- The session that opened it (null for manual problems, or once that session is deleted).
    origin_session_id integer references sessions (id) on delete set null
);

create index if not exists problems_status on problems (status);
