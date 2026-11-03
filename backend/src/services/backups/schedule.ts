// Drives the daily snapshot. Rather than firing at a fixed time (and missing the day whenever
// the Pi was off or mid-redeploy at that moment), it checks every hour and on boot whether
// today's snapshot exists — so the first pass after UTC midnight takes it, whenever that is.
import { pruneSnapshots, takeDailySnapshot } from './backups';

const HOUR_MS = 60 * 60 * 1000;

/** One pass: today's snapshot if missing, then retention. Never throws — a failure is logged
    (and shows as backup_ok=false on /health) and the next hourly pass retries. */
export const runBackupPass = (): void => {
    try {
        const taken = takeDailySnapshot();
        if (taken) console.log(`[backup] wrote ${taken}`);
        const pruned = pruneSnapshots();
        if (pruned.length) console.log(`[backup] pruned ${pruned.join(', ')}`);
    } catch (e) {
        console.error('[backup] snapshot pass failed', e);
    }
};

/** Runs a pass now, then hourly. Returns the timer so a caller could stop it. */
export const startBackupSchedule = (): ReturnType<typeof setInterval> => {
    runBackupPass();
    return setInterval(runBackupPass, HOUR_MS);
};
