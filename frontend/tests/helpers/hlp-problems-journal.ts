import type { JournalEntry, JournalInsight, Problem, ProblemDetail, ProblemUpdate } from '@therapy-aid/shared';

/* Fixtures for the Problems / ProblemDetail / Journal hook and page tests: full, valid objects
   with one-line overrides, so each test states only what it cares about. */

export const problem = (over: Partial<Problem> = {}): Problem => ({
    id: 1,
    title: 'Racing mind at night',
    description: 'Thoughts spiral when the lights go out.',
    status: 'active',
    created_at: '2026-09-01T12:00:00.000Z',
    updated_at: '2026-10-20T12:00:00.000Z',
    last_discussed_at: '2026-10-20T12:00:00.000Z',
    last_reviewed_at: null,
    origin_session_id: 4,
    is_stale: false,
    update_count: 2,
    latest_update: 'Tried the wind-down routine.',
    ...over,
});

export const update = (over: Partial<ProblemUpdate> = {}): ProblemUpdate => ({
    id: 1,
    problem_id: 1,
    session_id: 4,
    session_title: 'Racing mind, morning structure',
    body: 'David suggested a wind-down routine.',
    source: 'ai',
    created_at: '2026-10-20T12:00:00.000Z',
    ...over,
});

export const problem_detail = (over: Partial<ProblemDetail> = {}): ProblemDetail => ({ ...problem(), updates: [update()], ...over });

export const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
    id: 1,
    occurred_at: '2026-10-13T12:00:00.000Z',
    body: 'Rough night. Could not switch my head off.',
    created_at: '2026-10-13T12:00:00.000Z',
    updated_at: '2026-10-13T12:00:00.000Z',
    insight_count: 0,
    ...over,
});

export const insight = (over: Partial<JournalInsight> = {}): JournalInsight => ({ id: 1, entry_id: 1, body: 'You keep describing the **same loop**.', created_at: '2026-10-13T13:00:00.000Z', ...over });
