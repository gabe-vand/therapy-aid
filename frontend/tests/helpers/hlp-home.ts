import type { Dashboard, DashboardThread } from '@therapy-aid/shared';
import { focus_snapshot } from './hlp-sessions';

/* Fixtures for the Home tests: a GET /dashboard payload (three ready sessions, two threads — one
   stale — journal numbers and themes) overridable section by section, and the default route table
   Home loads (focus, dashboard, problems for the stale actions). */

const ago = (days: number) => new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

export const thread = (over: Partial<DashboardThread> = {}): DashboardThread => ({
    id: 3,
    title: 'Sleep and the racing mind',
    status: 'active',
    is_stale: false,
    last_discussed_at: ago(11),
    update_count: 2,
    marks: [true, false, true],
    journal_mentions: 4,
    ...over,
});

export const dashboard = (over: Partial<Dashboard> = {}): Dashboard => ({
    sessions: {
        total: 3,
        axis: [
            { id: 2, occurred_at: '2026-08-06T16:00:00.000Z', title: 'First session' },
            { id: 3, occurred_at: '2026-08-21T16:00:00.000Z', title: null },
            { id: 4, occurred_at: ago(11), title: 'Racing mind, ADHD, morning structure' },
        ],
        last: { id: 4, title: 'Racing mind, ADHD, morning structure', occurred_at: ago(11), advice: ['Write tomorrow’s first task before bed', 'Keep the phone out of the bedroom'] },
        typical_gap_days: 14,
    },
    threads: [thread(), thread({ id: 5, title: 'Avoiding hard conversations', is_stale: true, last_discussed_at: ago(40), marks: [true, false, false], journal_mentions: 0 })],
    journal: { entries_30d: 4, words_7d: 1250, streak_days: 3, last_entry: { id: 9, occurred_at: ago(0) }, themes: [{ problem_id: 3, title: 'Sleep and the racing mind', mentions: 4 }] },
    since_last_session: { entries: 2, notes: 3 },
    ...over,
});

export const home_routes = (over: Record<string, unknown> = {}) => ({ 'GET /api/focus': focus_snapshot(), 'GET /api/dashboard': dashboard(), 'GET /api/problems': [], ...over });
