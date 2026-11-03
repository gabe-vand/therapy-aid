-- Journal <-> problem links: the classifier (task 'classify', Haiku) reads each paragraph Gabe
-- finishes and, when confident, ties the entry to one of his problems. One row per (entry, problem)
-- holding the strongest match so far. They feed "In your journal lately" on Home and the
-- "In your journal" list on a problem's page. Deleted with the entry or the problem.
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists journal_problem_links (
    id integer primary key autoincrement,
    entry_id integer not null references journal_entries (id) on delete cascade,
    problem_id integer not null references problems (id) on delete cascade,
    -- 0..1 from the classifier.
    confidence real not null,
    -- The paragraph's first ~160 plain-text characters.
    excerpt text not null,
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    unique (entry_id, problem_id)
);

create index if not exists journal_problem_links_problem_id on journal_problem_links (problem_id);
