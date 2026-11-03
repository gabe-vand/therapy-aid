// Small, pure text helpers for everything that renders material into a prompt. Dates render in
// APP_TIMEZONE (not UTC) so "your Sep 11 session" is the day Gabe remembers; the output never
// depends on the current time, which is what keeps the context pack byte-stable (and cached).
import { app_env } from '@/services/common/svc-env';

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatter = (time_zone: string): Intl.DateTimeFormat => {
    let f = formatters.get(time_zone);
    if (!f) {
        f = new Intl.DateTimeFormat('en-US', { timeZone: time_zone, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        formatters.set(time_zone, f);
    }
    return f;
};

/** "Thu Sep 11, 2026" for an ISO timestamp, in APP_TIMEZONE. Unparseable input is returned as is. */
export const formatDay = (iso: string, time_zone: string = app_env.timezone): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const parts = Object.fromEntries(formatter(time_zone).formatToParts(date).map((p) => [p.type, p.value]));
    return `${parts.weekday} ${parts.month} ${parts.day}, ${parts.year}`;
};

/** Rough token estimate (4 chars ≈ 1 token) — good enough for budgeting, never billed on. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

/** The first `max_words` words of `text`, with " …" appended when it was cut. Whitespace inside
    the kept part is preserved (paragraphs survive). */
export const truncateWords = (text: string, max_words: number): string => {
    const trimmed = text.trim();
    const matches = [...trimmed.matchAll(/\S+/g)];
    if (matches.length <= max_words) return trimmed;
    const last = matches[max_words - 1]!;
    return `${trimmed.slice(0, last.index + last[0].length)} …`;
};

/** One markdown bullet per item; '' for an empty list. */
export const bullets = (items: string[]): string => items.map((item) => `- ${item.trim()}`).join('\n');
