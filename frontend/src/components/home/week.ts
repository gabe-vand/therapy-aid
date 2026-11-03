/* Pure date helpers for Home, all in the browser's local time (check-in days are local
   YYYY-MM-DD, the same key the API stores): the current Monday-start week for the check-in board,
   the greeting for the time of day, and whole-day distances for the rhythm tiles. No clock of
   their own — every function takes `now`, so tests pin a date. */

export type WeekDay = {
    // "YYYY-MM-DD", local
    day: string;
    // "M", "T", … for the label above the circle
    letter: string;
    // "Monday, Nov 2" for the button's accessible name
    long: string;
    is_today: boolean;
    is_future: boolean;
};

const pad = (n: number): string => String(n).padStart(2, '0');

/* A local date as "YYYY-MM-DD". */
export const day_key = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/* Monday … Sunday of the week containing `now`. */
export const week_of = (now: Date = new Date()): WeekDay[] => {
    const today = day_key(now);
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7), 12);
    return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12);
        const day = day_key(date);
        return { day, letter: date.toLocaleDateString('en-US', { weekday: 'narrow' }), long: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }), is_today: day === today, is_future: day > today };
    });
};

/* "Good morning" until noon, "Good afternoon" until 6pm, then "Good evening". */
export const greeting = (now: Date = new Date()): string => {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
};

/* Whole local calendar days from `iso` to `now` (0 = today), never negative. */
export const days_since = (iso: string, now: Date = new Date()): number => {
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return 0;
    const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
    const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
};

/* "today", "yesterday", "11 days ago". */
export const days_ago_phrase = (days: number): string => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);
