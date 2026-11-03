-- Smoke-test table for the hello-world shell: one row per "Record a visit" click. Proves the API
-- can write to SQLite and that the data survives a redeploy (the file lives in a Docker volume).
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists visits (
    id integer primary key autoincrement,
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
