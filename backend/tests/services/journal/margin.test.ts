import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as repo_insights from '@/repositories/journal-insights';
import * as svc_claude from '@/services/common/svc-claude';
import { renderProblemsForClassify } from '@/services/journal/margin/classify';
import { buildNoteEvidence } from '@/services/journal/margin/evidence';
import { MAX_NOTES_PER_ENTRY, noteParagraph, plainParagraph } from '@/services/journal/margin/margin';
import { listInsights } from '@/services/journal/journal';
import { getProblem } from '@/services/problems/problems';
import { resetDatabase, seedJournal, seedProblem, seedSession, seedUpdate } from '../../helpers/hlp-db';

// Margin notes: classify every paragraph (Haiku), record the link, write a note (Sonnet) only
// when asked and allowed. Claude is stubbed per task.

beforeEach(() => resetDatabase());

type Call = { task: string; messages: { content: unknown }[]; system: { text: string }[] };

const stubClaude = (classify: unknown, note: unknown = { kind: 'advice', body: 'On Sep 11 David suggested a worry list before bed; this paragraph is that worry, unlisted.', session_id: null }) => {
    const calls: Call[] = [];
    const spy = spyOn(svc_claude, 'completeStructured').mockImplementation((async (opts: Call) => {
        calls.push(opts);
        return opts.task === 'classify' ? classify : note;
    }) as never);
    return { calls, restore: () => spy.mockRestore() };
};

describe('noteParagraph', () => {
    let stub: ReturnType<typeof stubClaude>;
    afterEach(() => stub.restore());

    it('classifies, records the link, and writes a margin note anchored to the paragraph', async () => {
        const problem = seedProblem({ title: 'Racing mind at night' });
        const session = seedSession();
        seedUpdate(problem.id, { session_id: session.id, body: 'Tried the worry list twice.' });
        const entry = seedJournal();
        stub = stubClaude({ problem_id: problem.id, confidence: 0.85, because: 'thoughts speeding up at bedtime' }, { kind: 'advice', body: 'David suggested the worry list.', session_id: session.id });

        const result = (await noteParagraph(entry.id, 'Lay awake again, **thoughts** going a mile a minute, could not switch off.', true))!;
        expect(result.outcome).toBe('written');
        expect(result.link).toEqual({ problem_id: problem.id, problem_title: 'Racing mind at night', confidence: 0.85 });
        expect(result.note).toMatchObject({
            entry_id: entry.id,
            kind: 'advice',
            source: 'margin',
            problem_id: problem.id,
            problem_title: 'Racing mind at night',
            session_id: session.id,
            anchor: 'Lay awake again, thoughts going a mile a minute, could not switch off.',
        });

        expect(stub.calls.map((c) => c.task)).toEqual(['classify', 'margin_note']);
        expect(stub.calls[0]!.system.map((s) => s.text).join('\n')).toContain(`[problem #${problem.id}] Racing mind at night`);
        expect(String(stub.calls[1]!.messages[0]!.content)).toContain('Tried the worry list twice.');
        expect(String(stub.calls[1]!.messages[0]!.content)).toContain(`[session #${session.id},`);

        expect(listInsights(entry.id)!.map((n) => n.id)).toEqual([result.note!.id]);
        expect(getProblem(problem.id)!.journal_mentions).toMatchObject([{ entry_id: entry.id, confidence: 0.85, excerpt: expect.stringContaining('Lay awake again') }]);
    });

    it('records the link but writes nothing when write is false', async () => {
        const problem = seedProblem();
        const entry = seedJournal();
        stub = stubClaude({ problem_id: problem.id, confidence: 0.9, because: 'x' });
        const result = (await noteParagraph(entry.id, 'A paragraph that is clearly about the racing mind at night.', false))!;
        expect(result).toMatchObject({ outcome: 'skipped', note: null, link: { problem_id: problem.id } });
        expect(stub.calls.map((c) => c.task)).toEqual(['classify']);
        expect(getProblem(problem.id)!.journal_mentions).toHaveLength(1);
    });

    it('answers no_match without a link for low confidence, null ids, or unknown ids', async () => {
        const problem = seedProblem();
        const entry = seedJournal();
        for (const reply of [
            { problem_id: problem.id, confidence: 0.4, because: '' },
            { problem_id: null, confidence: 0.9, because: '' },
            { problem_id: 999, confidence: 0.9, because: '' },
        ]) {
            stub = stubClaude(reply);
            expect((await noteParagraph(entry.id, 'Went to the store and bought some apples and a loaf of bread.', true))!.outcome).toBe('no_match');
            stub.restore();
        }
        stub = stubClaude({ problem_id: null, confidence: 0, because: '' });
        expect(getProblem(problem.id)!.journal_mentions).toHaveLength(0);
    });

    it('never calls the model when there are no active problems', async () => {
        seedProblem({ status: 'resolved' });
        const entry = seedJournal();
        stub = stubClaude({ problem_id: 1, confidence: 1, because: '' });
        expect((await noteParagraph(entry.id, 'Anything at all written here, long enough to pass.', true))!.outcome).toBe('no_match');
        expect(stub.calls).toHaveLength(0);
    });

    it('writes one note per problem per entry (duplicate), and stops at the per-entry cap', async () => {
        const problems = Array.from({ length: MAX_NOTES_PER_ENTRY + 1 }, (_, i) => seedProblem({ title: `Problem ${i}` }));
        const entry = seedJournal();
        stub = stubClaude({ problem_id: problems[0]!.id, confidence: 0.9, because: '' });
        expect((await noteParagraph(entry.id, 'First paragraph about the first problem, long enough.', true))!.outcome).toBe('written');
        expect((await noteParagraph(entry.id, 'Second paragraph about the first problem again, long enough.', true))!.outcome).toBe('duplicate');
        stub.restore();

        for (const p of problems.slice(1, MAX_NOTES_PER_ENTRY)) {
            stub = stubClaude({ problem_id: p.id, confidence: 0.9, because: '' });
            expect((await noteParagraph(entry.id, `A paragraph about ${p.title}, long enough to count.`, true))!.outcome).toBe('written');
            stub.restore();
        }
        stub = stubClaude({ problem_id: problems[MAX_NOTES_PER_ENTRY]!.id, confidence: 0.9, because: '' });
        expect((await noteParagraph(entry.id, 'One more paragraph about one more problem, long enough.', true))!.outcome).toBe('capped');
        expect(repo_insights.countMarginNotes(entry.id)).toBe(MAX_NOTES_PER_ENTRY);
    });

    it('keeps the raw session_id only when that session exists, and keeps a dismissed note out of the list', async () => {
        const problem = seedProblem();
        const entry = seedJournal();
        stub = stubClaude({ problem_id: problem.id, confidence: 0.9, because: '' }, { kind: 'question', body: 'What would it take to put the phone in the other room?', session_id: 4242 });
        const result = (await noteParagraph(entry.id, 'Checked the phone the moment I woke up, again, before anything.', true))!;
        expect(result.note!.session_id).toBeNull();
        expect(repo_insights.dismissInsight(entry.id, result.note!.id)).not.toBeNull();
        expect(listInsights(entry.id)).toEqual([]);
        expect(repo_insights.hasMarginNoteFor(entry.id, problem.id)).toBe(false);
    });

    it('is null for a missing entry', async () => {
        stub = stubClaude({ problem_id: 1, confidence: 1, because: '' });
        expect(await noteParagraph(999, 'A paragraph for an entry that does not exist at all.', true)).toBeNull();
    });
});

describe('helpers', () => {
    it('plainParagraph strips marks and collapses whitespace', () => {
        expect(plainParagraph('**Bold** and _soft_, a [link](http://x) and\n  a `code` word')).toBe('Bold and soft, a link and a code word');
    });

    it('renderProblemsForClassify lists ids, titles and clipped descriptions', () => {
        const text = renderProblemsForClassify([{ id: 3, title: 'T', description: 'd'.repeat(300) } as never]);
        expect(text).toContain('[problem #3] T — ');
        expect(text.length).toBeLessThan(300);
    });

    it('buildNoteEvidence falls back to the origin session and says when nothing matched', () => {
        const session = seedSession({ summary: { title: 'S', overview: 'o', key_points: ['kp'], therapist_advice: ['Advice A'] } });
        const problem = seedProblem({ origin_session_id: session.id });
        const evidence = buildNoteEvidence(problem, 'zzzz qqqq');
        expect(evidence).toContain('Advice A');
        expect(evidence).toContain(`[session #${session.id}]`);
        const orphan = seedProblem({ origin_session_id: null });
        expect(buildNoteEvidence(orphan, 'zzzz qqqq')).toContain('No session matched');
    });
});
