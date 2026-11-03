import { describe, expect, it } from 'bun:test';
import type { ProblemRow } from '@/repositories/problems';
import { parseFocusContent, renderFocus, renderJournal, renderProblems, renderProblemsForMapping, renderProfile, renderSessionFull, renderSessionLine } from '@/services/context/pack-sections';
import { parseSessionSummary } from '@/services/context/session-summary';
import { summary } from '../../helpers/hlp-db';

// Each pack section as a pure function of rows.

const problem = (over: Partial<ProblemRow>): ProblemRow => ({
    id: 1,
    title: 'Racing mind',
    description: 'Thoughts speed up at night.',
    status: 'active',
    created_at: '2026-05-01T12:00:00.000Z',
    updated_at: '2026-05-01T12:00:00.000Z',
    last_discussed_at: null,
    last_reviewed_at: null,
    origin_session_id: null,
    ...over,
});

const session = { id: 4, occurred_at: '2026-09-11T16:00:00.000Z', title: 'Racing mind, morning structure', summary_json: JSON.stringify(summary()) };

describe('summary / focus parsing', () => {
    it('reads stored JSON leniently and degrades to null', () => {
        expect(parseSessionSummary(JSON.stringify({ title: 'T', overview: 'O' }))).toEqual({ title: 'T', overview: 'O', key_points: [], therapist_advice: [] });
        const error = console.error;
        console.error = () => {};
        expect(parseSessionSummary('{not json')).toBeNull();
        expect(parseFocusContent('nope')).toBeNull();
        console.error = error;
        expect(parseSessionSummary(null)).toBeNull();
        expect(parseFocusContent(JSON.stringify({ headline: 'H', items: [] }))).toEqual({ headline: 'H', items: [] });
    });
});

describe('sections', () => {
    it('profile and focus have explicit empty states', () => {
        expect(renderProfile('')).toBe('# About Gabe\n\n(No profile written yet.)');
        expect(renderFocus(null)).toBe('# Current focus\n\n(No focus generated yet.)');
    });

    it('focus lists items with their problem ids', () => {
        const row = { id: 1, session_id: null, created_at: 'x', content_json: JSON.stringify({ headline: 'Protect sleep.', items: [{ title: 'Worry list', why: 'It worked twice.', action: 'Do it nightly.', problem_id: 3 }] }) };
        expect(renderFocus(row)).toBe('# Current focus\n\nProtect sleep.\n\n1. **Worry list** [problem #3] — It worked twice. Action: Do it nightly.');
    });

    it('problems: active most-recently-discussed first with their last 2 notes, then resolved titles', () => {
        const active = [problem({ id: 1, last_discussed_at: '2026-06-01T12:00:00.000Z' }), problem({ id: 2, title: 'Nicole', last_discussed_at: '2026-09-01T12:00:00.000Z' })];
        const notes = new Map([
            [1, [1, 2, 3].map((n) => ({ id: n, problem_id: 1, session_id: n === 1 ? 7 : null, body: `note ${n}`, source: (n === 2 ? 'manual' : 'ai') as 'ai' | 'manual', created_at: '2026-06-01T12:00:00.000Z', session_title: null }))],
        ]);
        const text = renderProblems(active, [problem({ id: 9, title: 'Exams', status: 'resolved' })], notes);
        expect(text.indexOf('[problem #2]')).toBeLessThan(text.indexOf('[problem #1]'));
        expect(text).toContain('- Mon Jun 1, 2026 [session #7]: note 1');
        expect(text).toContain('- Mon Jun 1, 2026 (Gabe’s note): note 2');
        expect(text).not.toContain('note 3');
        expect(text).toContain('## Resolved\n\n- Exams [problem #9]');
        expect(renderProblems([], [], new Map())).toBe('# Problems\n\n(No problems recorded yet.)');
    });

    it('a session renders in full or as one line', () => {
        expect(renderSessionFull(session)).toBe(
            [
                '## Fri Sep 11, 2026 — Racing mind, morning structure [session #4]',
                summary().overview,
                'Key points:\n- Racing thoughts peak after 11pm\n- Mornings have no anchor',
                'What David suggested:\n- Write a worry list before bed\n- Same wake time every day',
            ].join('\n\n'),
        );
        expect(renderSessionLine(session)).toBe('- Fri Sep 11, 2026 — Racing mind, morning structure [session #4]: Racing thoughts peak after 11pm; Mornings have no anchor');
    });

    it('journal entries are cut at 700 words', () => {
        const long = { id: 5, occurred_at: '2026-10-13T16:00:00.000Z', body: 'word '.repeat(800), created_at: 'x', updated_at: 'x' };
        const text = renderJournal([long]);
        expect(text.startsWith('# Recent journal entries (newest first)\n\n## Tue Oct 13, 2026 [entry #5]')).toBe(true);
        expect(text.match(/word/g)).toHaveLength(700);
        expect(text.endsWith(' …')).toBe(true);
    });

    it('the mapping view lists every problem with id, status, description and latest note', () => {
        const notes = new Map([[1, [{ id: 1, problem_id: 1, session_id: 4, body: 'Tried it.', source: 'ai' as const, created_at: '2026-09-11T16:00:00.000Z', session_title: 'S' }]]]);
        expect(renderProblemsForMapping([problem({ id: 1 }), problem({ id: 2, title: 'Exams', status: 'resolved', description: '' })], notes)).toBe(
            '# Existing problems\n\n- [problem #1] (active) Racing mind — Thoughts speed up at night. Latest note (Fri Sep 11, 2026): Tried it.\n- [problem #2] (resolved) Exams — no description.',
        );
    });
});
