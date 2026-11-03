-- Progress notes on a problem: one per (session, problem) the summarizer mapped (source 'ai'),
-- or typed by Gabe (source 'manual'). Deleting a session keeps its notes, with session_id nulled.
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists problem_updates (
    id integer primary key autoincrement,
    problem_id integer not null references problems (id) on delete cascade,
    session_id integer references sessions (id) on delete set null,
    body text not null,
    source text not null check (source in ('ai', 'manual')),
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists problem_updates_problem_id on problem_updates (problem_id);
create index if not exists problem_updates_session_id on problem_updates (session_id);
