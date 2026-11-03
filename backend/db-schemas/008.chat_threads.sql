-- Chat threads. The title is auto-set from the first user message.
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists chat_threads (
    id integer primary key autoincrement,
    title text not null default 'New chat',
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists chat_threads_updated_at on chat_threads (updated_at);
