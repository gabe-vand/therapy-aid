// Daily database snapshots, so a bad write, a bad migration or a dead SD card never costs more
// than a day. One file per UTC day (therapy-aid-YYYY-MM-DD.sqlite), verified before it is kept,
// newest `backup_retention_days` retained. Every function is idempotent — the schedule calls
// them hourly and on every boot.
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import * as repo_backups from '@/repositories/backups';
import { app_env } from '@/services/common/svc-env';

const SNAPSHOT = /^therapy-aid-\d{4}-\d{2}-\d{2}\.sqlite$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The snapshot file name for a given day (UTC). Names sort lexically in date order. */
export const snapshotName = (day: Date): string => `therapy-aid-${day.toISOString().slice(0, 10)}.sqlite`;

/** All snapshots in `dir`, oldest first. Ignores anything else in the folder. */
export const listSnapshots = (dir: string = app_env.backup_dir): string[] => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((name) => SNAPSHOT.test(name))
        .sort();
};

/** Takes today's snapshot unless it already exists. Returns the file written, or null when
    today's was already there. Throws if the copy fails its integrity check (nothing is kept). */
export const takeDailySnapshot = (dir: string = app_env.backup_dir, now: Date = new Date()): string | null => {
    mkdirSync(dir, { recursive: true });
    const name = snapshotName(now);
    const final_path = join(dir, name);
    if (existsSync(final_path)) return null;

    // Written under a temp name and renamed only once verified, so a file with a snapshot's name
    // is always a good one. A crash mid-copy leaves the .tmp behind; VACUUM INTO won't overwrite.
    const tmp_path = `${final_path}.tmp`;
    rmSync(tmp_path, { force: true });
    repo_backups.vacuumInto(tmp_path);
    if (!repo_backups.integrityCheck(tmp_path)) {
        rmSync(tmp_path, { force: true });
        throw new Error(`snapshot ${name} failed integrity_check`);
    }
    renameSync(tmp_path, final_path);
    return name;
};

/** Deletes all but the newest `keep` snapshots; returns the names deleted. */
export const pruneSnapshots = (dir: string = app_env.backup_dir, keep: number = app_env.backup_retention_days): string[] => {
    const snapshots = listSnapshots(dir);
    const doomed = snapshots.slice(0, Math.max(0, snapshots.length - keep));
    for (const name of doomed) rmSync(join(dir, name));
    return doomed;
};

/** True when the newest snapshot is from today or yesterday (UTC) — i.e. backups are running. */
export const hasRecentSnapshot = (dir: string = app_env.backup_dir, now: Date = new Date()): boolean => {
    const newest = listSnapshots(dir).at(-1);
    return newest === snapshotName(now) || newest === snapshotName(new Date(now.getTime() - DAY_MS));
};
