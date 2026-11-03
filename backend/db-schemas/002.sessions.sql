-- Therapy sessions. Both intake pipelines (a live recording, or notes pasted afterwards) land
-- here and move through status → ready. occurred_at is when the session happened (editable);
-- created_at/updated_at are system time. All timestamps are ISO-8601 UTC text.
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists sessions (
    id integer primary key autoincrement,
    occurred_at text not null,
    source text not null check (source in ('recording', 'notes')),
    status text not null check (status in ('recording', 'uploaded', 'transcribing', 'summarizing', 'ready', 'failed')),
    title text,
    notes text,
    transcript text,
    -- JSON of SessionSummary (packages/shared/src/types/sessions.ts) once summarized.
    summary_json text,
    -- Human-readable reason for status 'failed'; cleared on retry.
    error text,
    -- Recordings only: the assembled audio file under RECORDINGS_DIR and its MIME type.
    audio_path text,
    audio_mime text,
    duration_sec real,
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists sessions_occurred_at on sessions (occurred_at);
create index if not exists sessions_status on sessions (status);
