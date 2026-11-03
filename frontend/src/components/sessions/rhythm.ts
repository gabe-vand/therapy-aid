import type { SessionListItem } from '@therapy-aid/shared';
import { elapsed_phrase, format_date, format_month } from '@/services/dates';

/* Pure helpers behind the Sessions screen: the one-line rhythm sentence under the title ("6
   sessions since Aug 6 · usually every 2 weeks · last one 11 days ago") and the month groups the
   timeline draws. No React, so they are tested on their own. */

/* "every 5 days", "every week", "every 2 weeks" — a median gap in words. */
export const gap_phrase = (days: number): string => {
    const d = Math.max(1, Math.round(days));
    if (d < 10) return `every ${d} ${d === 1 ? 'day' : 'days'}`;
    const weeks = Math.round(d / 7);
    return weeks === 1 ? 'every week' : `every ${weeks} weeks`;
};

/* "today", "yesterday", "11 days ago", "3 weeks ago". */
export const ago_phrase = (iso: string, now: Date = new Date()): string => {
    const phrase = elapsed_phrase(iso, now);
    if (phrase === '0 days') return 'today';
    if (phrase === '1 day') return 'yesterday';
    return `${phrase} ago`;
};

type RhythmInput = { sessions: SessionListItem[]; typical_gap_days: number | null; now?: Date };

/* The live subtitle. Built from the list (newest first) so it works even while the dashboard is
   still loading or failed; the typical gap only exists once the dashboard has answered. */
export const rhythm_sentence = ({ sessions, typical_gap_days, now = new Date() }: RhythmInput): string => {
    if (sessions.length === 0) return 'Every conversation with David, in one place.';
    const first = sessions[sessions.length - 1]!;
    const last = sessions[0]!;
    const parts = [sessions.length === 1 ? `1 session, on ${format_date(first.occurred_at, { year: false })}` : `${sessions.length} sessions since ${format_date(first.occurred_at, { year: false })}`];
    if (typical_gap_days !== null) parts.push(`usually ${gap_phrase(typical_gap_days)}`);
    parts.push(`last one ${ago_phrase(last.occurred_at, now)}`);
    return parts.join(' · ');
};

export type MonthGroup = { month: string; items: SessionListItem[] };

// The list arrives newest-first, so consecutive rows with the same month share a group.
export const group_by_month = (sessions: SessionListItem[]): MonthGroup[] => {
    const groups: MonthGroup[] = [];
    for (const s of sessions) {
        const month = format_month(s.occurred_at);
        const last = groups[groups.length - 1];
        if (last && last.month === month) last.items.push(s);
        else groups.push({ month, items: [s] });
    }
    return groups;
};
