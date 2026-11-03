-- Chat messages, deleted with their thread. Only the user's text and the final assistant answer
-- are stored — tool calls and retrieved excerpts are rebuilt per turn, never persisted.
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists chat_messages (
    id integer primary key autoincrement,
    thread_id integer not null references chat_threads (id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists chat_messages_thread_id on chat_messages (thread_id);
