/* Date display and date-input helpers — every date the SPA shows goes through here, so the app
   reads the same everywhere ("Sep 11, 2026", "3 weeks ago"). The API stores ISO-8601 UTC; these
   render in the browser's local time zone. Invalid or null input renders as '—', never throws. */

const DASH = '—';

const parse = (iso: string | null | undefined): Date | null => {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
};

/* "Sep 11, 2026"; { weekday: true } → "Thu, Sep 11, 2026"; { year: false } → "Sep 11". */
export const format_date = (iso: string | null | undefined, opts: { weekday?: boolean; year?: boolean } = {}): string => {
    const date = parse(iso);
    if (!date) return DASH;
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(opts.year === false ? {} : { year: 'numeric' }),
        ...(opts.weekday ? { weekday: 'short' } : {}),
    });
};

/* "3:45 PM". */
export const format_time = (iso: string | null | undefined): string => {
    const date = parse(iso);
    return date ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : DASH;
};

/* "September 2026" — the Sessions list's month group heading. */
export const format_month = (iso: string | null | undefined): string => {
    const date = parse(iso);
    return date ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : DASH;
};

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 3600],
    ['month', 30 * 24 * 3600],
    ['week', 7 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
];

const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

/* "just now", "5 minutes ago", "yesterday", "3 weeks ago", "in 2 days". */
export const relative_time = (iso: string | null | undefined, now: Date = new Date()): string => {
    const date = parse(iso);
    if (!date) return DASH;
    const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
    if (Math.abs(seconds) < 60) return 'just now';
    for (const [unit, size] of UNITS) {
        if (Math.abs(seconds) >= size) return relative.format(Math.trunc(seconds / size), unit);
    }
    return 'just now';
};

const pad = (n: number): string => String(n).padStart(2, '0');

/* ISO → "YYYY-MM-DD" for <input type="date"> (local day). '' for null/invalid. */
export const to_date_input = (iso: string | null | undefined): string => {
    const date = parse(iso);
    return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '';
};

/* "YYYY-MM-DD" from a date input → ISO at 12:00 LOCAL that day (noon keeps the day stable
   across time zones and DST). null for an empty/invalid value. */
export const from_date_input = (value: string): string | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/* Today as "YYYY-MM-DD" (the default for date fields). */
export const today_input = (now: Date = new Date()): string => to_date_input(now.toISOString());
