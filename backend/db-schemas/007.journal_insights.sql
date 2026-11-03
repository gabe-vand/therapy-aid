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

-- 2026-11-03: insights became "notes" of two kinds: margin notes written automatically about one
-- paragraph while Gabe writes (source 'margin', anchored to the paragraph's opening words, tied to
-- a problem and sometimes a session) and the on-demand reflections that were here before (source
-- 'reflection'). Dismissed notes stay for history but are hidden. svc-migrate treats an ALTER whose
-- column already exists as applied, which is what keeps this file idempotent.
alter table journal_insights add column kind text not null default 'reflection';
alter table journal_insights add column source text not null default 'reflection';
alter table journal_insights add column problem_id integer references problems (id) on delete set null;
alter table journal_insights add column session_id integer references sessions (id) on delete set null;
alter table journal_insights add column anchor text;
alter table journal_insights add column dismissed_at text;
