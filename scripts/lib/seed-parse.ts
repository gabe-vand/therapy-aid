// Pure parsing for the seed importer: splits journal.md / therapy-notes.md into dated entries and
// builds the API base URL. Kept free of I/O and of any server import so backend/tests/scripts can
// test it with plain strings (the real seed files are personal data and never reach a test).

export interface DatedEntry {
    /** YYYY-MM-DD, straight from the `## YYYY-MM-DD` heading. */
    date: string;
    /** Everything under the heading up to the next dated heading, trimmed. */
    body: string;
}

// A dated heading is `## ` + an ISO date, optionally followed by a title ("## 2026-08-06 — Intake").
// `###` sub-headings and other `##` headings are body text, not boundaries.
const HEADING = /^##[ \t]+(\d{4}-\d{2}-\d{2})\b[^\n]*$/;

/** True when `date` is a real calendar day (rejects 2026-02-31, which `new Date` would roll over). */
export const isRealDate = (date: string): boolean => {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    const probe = new Date(y, m - 1, d);
    return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d;
};

/**
 * Splits markdown on `^## YYYY-MM-DD` headings. Text before the first dated heading (a title, a
 * preamble) is dropped; entries with an empty body are dropped. Result is sorted oldest first, and
 * two headings for the same day are merged in file order so the "one per date" idempotency holds.
 */
export const splitDated = (markdown: string): DatedEntry[] => {
    const chunks = new Map<string, string[]>();
    let current: string[] | null = null;
    for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
        const match = HEADING.exec(line);
        if (match) {
            const date = match[1]!;
            if (!isRealDate(date)) throw new Error(`Not a real calendar date in a heading: "${line.trim()}"`);
            current = chunks.get(date) ?? [];
            chunks.set(date, current);
        } else if (current) {
            current.push(line);
        }
    }
    return [...chunks.entries()]
        .map(([date, lines]) => ({ date, body: lines.join('\n').trim() }))
        .filter((entry) => entry.body.length > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
};

/** `YYYY-MM-DD` → ISO instant for 12:00 on that day in the machine's local zone (midday dodges DST and UTC-rollover surprises). */
export const occurredAt = (date: string): string => new Date(`${date}T12:00:00`).toISOString();

/** The machine-local `YYYY-MM-DD` of an ISO instant: how existing rows are matched to seed dates. */
export const localDay = (iso: string): string => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

/**
 * The URL every request is built on. Localhost talks to the API directly (bare paths); anything
 * else is the tailnet front door, where nginx only forwards `/api/*`. An explicit `prefix`
 * overrides the guess, and a URL that already ends in /api is never doubled.
 */
export const apiBase = (url: string, prefix?: string): string => {
    const parsed = new URL(url);
    const trimmed = parsed.pathname.replace(/\/+$/, '');
    const want = prefix ?? (LOCAL_HOSTS.has(parsed.hostname) ? '' : '/api');
    const path = want && trimmed.endsWith(want) ? trimmed : `${trimmed}${want}`;
    return `${parsed.origin}${path}`;
};
