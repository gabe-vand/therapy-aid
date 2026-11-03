import { describe, expect, it } from 'vitest';
import { MAX_STARTERS, starter_questions } from '@/components/chat/starters';
import { problem } from '../../helpers/hlp-problems-journal';
import { focus_snapshot } from '../../helpers/hlp-sessions';

/* The empty conversation's suggested questions, built from the focus and the problems. */
describe('starter_questions', () => {
    it('falls back to the general questions with no material', () => {
        expect(starter_questions({ focus: null, problems: [] })).toEqual(['What should I bring up next session?', 'Summarise my last session', 'What patterns show up in my journal lately?']);
    });

    it('asks about the top focus item and the two most recently discussed active problems', () => {
        const problems = [
            problem({ id: 1, title: 'Racing mind at night', last_discussed_at: '2026-10-20T12:00:00.000Z' }),
            problem({ id: 2, title: 'ADHD and mornings', last_discussed_at: '2026-10-28T12:00:00.000Z' }),
            problem({ id: 3, title: 'Old one', last_discussed_at: '2026-06-01T12:00:00.000Z' }),
            problem({ id: 4, title: 'Never discussed', last_discussed_at: null }),
            problem({ id: 5, title: 'Resolved one', status: 'resolved', last_discussed_at: '2026-11-01T12:00:00.000Z' }),
        ];
        const questions = starter_questions({ focus: focus_snapshot({ items: [{ title: 'Protect your mornings', why: '', action: '', problem_id: null }] }), problems });
        expect(questions).toEqual([
            'What should I bring up next session?',
            'How has “protect your mornings” been going?',
            'What did David say about ADHD and mornings?',
            'What did David say about racing mind at night?',
            'Summarise my last session',
            'What patterns show up in my journal lately?',
        ]);
        expect(questions.length).toBeLessThanOrEqual(MAX_STARTERS);
    });
});
