-- Key/value app settings. Today one key: 'profile' (the "About me" text every prompt includes).
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists app_settings (
    key text primary key,
    value text not null,
    updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
