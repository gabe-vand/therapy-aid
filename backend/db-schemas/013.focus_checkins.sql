-- Focus check-ins: one row per day Gabe ticked a focus item's action on Home ("sat 3 minutes
-- before the phone: Tue"). Keyed by the snapshot, so a regenerated focus starts a fresh week.
-- day is YYYY-MM-DD in Gabe's local time (the SPA decides the day, the API just stores it).
-- Re-run on every boot by dbMigrate(), so every statement here must stay idempotent.
create table if not exists focus_checkins (
    id integer primary key autoincrement,
    snapshot_id integer not null references focus_snapshots (id) on delete cascade,
    item_index integer not null,
    day text not null,
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    unique (snapshot_id, item_index, day)
);
