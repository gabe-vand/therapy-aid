// Pure date arithmetic for the dashboard: local day keys in APP_TIMEZONE, the typical gap
// between sessions, and the journal streak. No I/O, no clock of its own — every function takes
// `now`, so the dashboard tests pin a date.
import { app_env } from '@/services/common/svc-env';

const DAY_MS = 24 * 60 * 60 * 1000;
const key_formatters = new Map<string, Intl.DateTimeFormat>();

/** "YYYY-MM-DD" for an ISO timestamp in `time_zone` (en-CA formats dates that way natively). */
export const dayKey = (iso: string | Date, time_zone: string = app_env.timezone): string => {
    let f = key_formatters.get(time_zone);
    if (!f) {
        f = new Intl.DateTimeFormat('en-CA', { timeZone: time_zone, year: 'numeric', month: '2-digit', day: '2-digit' });
        key_formatters.set(time_zone, f);
    }
    return f.format(typeof iso === 'string' ? new Date(iso) : iso);
};

/** The day key `days` days before `key` (calendar arithmetic on the key itself, zone-free). */
export const shiftDay = (key: string, days: number): string => {
    const [y, m, d] = key.split('-').map(Number) as [number, number, number];
    return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
};

/** Whole days from `iso` to `now`, floored at 0. */
export const daysAgo = (iso: string, now: number): number => Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS));

/** Median gap in days between consecutive timestamps (the newest `window` gaps), rounded;
    null with fewer than two timestamps. Order of input does not matter. */
export const typicalGapDays = (timestamps: string[], window = 6): number | null => {
    const sorted = timestamps.map((t) => Date.parse(t)).sort((a, b) => a - b);
    if (sorted.length < 2) return null;
    const gaps = sorted
        .slice(1)
        .map((t, i) => (t - sorted[i]!) / DAY_MS)
        .slice(-window)
        .sort((a, b) => a - b);
    const mid = Math.floor(gaps.length / 2);
    const median = gaps.length % 2 ? gaps[mid]! : (gaps[mid - 1]! + gaps[mid]!) / 2;
    return Math.max(1, Math.round(median));
};

/** Consecutive days with an entry, counting back from today (or from yesterday when today has
    none yet — a streak is not broken until the day is over). */
export const streakDays = (entry_days: Iterable<string>, today: string): number => {
    const days = new Set(entry_days);
    let cursor = days.has(today) ? today : shiftDay(today, 1);
    let streak = 0;
    while (days.has(cursor)) {
        streak += 1;
        cursor = shiftDay(cursor, 1);
    }
    return streak;
};

/** Words in a Markdown body (syntax counted as words is fine at this precision). */
export const wordCount = (text: string): number => (text.match(/\S+/g) ?? []).length;
