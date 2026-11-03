import type { FocusSnapshot, Problem, Session, SessionListItem } from '@therapy-aid/shared';

/* Fixtures for the session / home / record tests: a full Session, a list row, a Problem and a
   FocusSnapshot, each overridable field by field. */

export const session = (over: Partial<Session> = {}): Session => ({
    id: 4,
    occurred_at: '2026-09-11T16:00:00.000Z',
    source: 'notes',
    status: 'ready',
    title: 'Racing mind, ADHD, morning structure',
    created_at: '2026-09-11T17:00:00.000Z',
    notes: null,
    transcript: null,
    summary: {
        title: 'Racing mind, ADHD, morning structure',
        overview: 'We talked about the **racing mind** at night.',
        key_points: ['Mornings set the tone', 'Phone stays out of the bedroom'],
        therapist_advice: ['Write tomorrow’s first task before bed'],
    },
    error: null,
    duration_sec: null,
    problem_updates: [],
    ...over,
});

export const list_item = (over: Partial<SessionListItem> = {}): SessionListItem => ({
    id: 4,
    occurred_at: '2026-09-11T16:00:00.000Z',
    source: 'notes',
    status: 'ready',
    title: 'Racing mind, ADHD, morning structure',
    created_at: '2026-09-11T17:00:00.000Z',
    ...over,
});

export const problem = (over: Partial<Problem> = {}): Problem => ({
    id: 3,
    title: 'Sleep and the racing mind',
    description: 'Cannot switch off at night.',
    status: 'active',
    created_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-06-01T12:00:00.000Z',
    last_discussed_at: '2026-08-01T12:00:00.000Z',
    last_reviewed_at: null,
    origin_session_id: 1,
    is_stale: false,
    update_count: 2,
    latest_update: null,
    ...over,
});

export const focus_snapshot = (over: Partial<FocusSnapshot> = {}): FocusSnapshot => ({
    id: 1,
    session_id: 4,
    created_at: '2026-09-12T12:00:00.000Z',
    headline: 'Protect your mornings this week.',
    items: [{ title: 'Write the first task the night before', why: 'David suggested it on Sep 11.', action: 'Do it three nights this week.', problem_id: 3 }],
    ...over,
});
