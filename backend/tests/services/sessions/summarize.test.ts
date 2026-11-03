import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Utterance } from '@/services/common/svc-deepgram';
import { putProfile } from '@/services/settings/settings';
import { clampExtraction, mapProblems, MAX_NEW_PROBLEMS } from '@/services/sessions/map-problems';
import { buildSummarizeMessage, SUMMARIZE_SYSTEM } from '@/services/sessions/prompts';
import { buildMapMessage, MAP_PROBLEMS_SYSTEM } from '@/services/sessions/prompts-map';
import { clampSummary, clampTitle, summarizeSession } from '@/services/sessions/summarize';
import { buildTranscript, mergeTurns } from '@/services/sessions/transcript-format';
import { resetDatabase, seedProblem, seedSession } from '../../helpers/hlp-db';
import { stubClaude, SUMMARY, uploadedNotes } from './fixtures';

// The two narrow AI calls and their text: what each call sends (task, context, evidence), how the
// replies are clamped to the documented limits, and the transcript formatting.

let stub: ReturnType<typeof stubClaude>;
beforeEach(() => {
    resetDatabase();
    stub = stubClaude();
});
afterEach(() => stub.mockRestore());

describe('summarizeSession', () => {
    it('calls the summarize task with the profile, problems, earlier sessions and the notes', async () => {
        putProfile('Gabe is a CS student with ADHD.');
        const problem = seedProblem({ title: 'Racing mind at night' });
        seedSession({ occurred_at: '2026-09-04T16:00:00.000Z', title: 'Earlier session' });
        const session = uploadedNotes({ occurred_at: '2026-09-11T16:00:00.000Z', notes: 'MY NOTES TEXT', title: 'Hint title' });

        const summary = await summarizeSession(session);

        expect(summary).toEqual(SUMMARY);
        const [call] = stub.spy.mock.calls;
        const opts = call![0] as { task: string; system: { text: string; cache_control?: unknown }[]; messages: { role: string; content: string }[] };
        expect(opts.task).toBe('summarize');
        expect(opts.system[0]!.text).toBe(SUMMARIZE_SYSTEM);
        expect(opts.system[0]!.cache_control).toEqual({ type: 'ephemeral' });
        const user = opts.messages[0]!.content;
        expect(user).toContain('Gabe is a CS student with ADHD.');
        expect(user).toContain(`[problem #${problem.id}]`);
        expect(user).toContain('Earlier session');
        expect(user).toContain('MY NOTES TEXT');
        expect(user).toContain("Gabe's own title for it: Hint title");
    });

    it('does not leak later sessions into the context when history is seeded in order', async () => {
        seedSession({ occurred_at: '2026-10-30T16:00:00.000Z', title: 'FUTURE SESSION' });
        const session = uploadedNotes({ occurred_at: '2026-09-11T16:00:00.000Z' });
        await summarizeSession(session);
        expect(stub.calls[0]!.user).not.toContain('FUTURE SESSION');
    });

    it('refuses a session with nothing to read', async () => {
        const empty = uploadedNotes({ notes: '   ' });
        await expect(summarizeSession(empty)).rejects.toThrow(/no notes/);
    });
});

describe('mapProblems', () => {
    it('calls the map_problems task with the summary and the problem list only', async () => {
        const problem = seedProblem({ title: 'Racing mind at night' });
        await mapProblems('2026-09-11T16:00:00.000Z', SUMMARY);
        const opts = stub.spy.mock.calls[0]![0] as { task: string; system: { text: string }[] };
        expect(opts.task).toBe('map_problems');
        expect(opts.system[0]!.text).toBe(MAP_PROBLEMS_SYSTEM);
        expect(stub.calls[0]!.user).toContain(SUMMARY.title);
        expect(stub.calls[0]!.user).toContain(`[problem #${problem.id}] (active) Racing mind at night`);
    });
});

describe('clamping', () => {
    it('cuts a long title at a word boundary within 60 characters', () => {
        const long = 'Racing mind at night and the long road to better morning structure with David';
        const cut = clampTitle(long);
        expect(cut.length).toBeLessThanOrEqual(60);
        expect(cut.endsWith('…')).toBe(true);
        expect(cut).toBe('Racing mind at night and the long road to better morning…');
        expect(clampTitle('  Short   title ')).toBe('Short title');
        const sixty = 'a'.repeat(30) + ' ' + 'b'.repeat(29);
        expect(clampTitle(sixty)).toBe(sixty);
        expect(clampTitle('Hi ' + 'x'.repeat(70))).toBe('Hi…');
    });

    it('limits and cleans the summary lists and falls back to the session title when the model gave none', () => {
        const out = clampSummary({ title: '  ', overview: ' text ', key_points: Array.from({ length: 12 }, (_, i) => ` p${i} `), therapist_advice: ['', 'a'] }, 'Mine');
        expect(out.title).toBe('Mine');
        expect(out.overview).toBe('text');
        expect(out.key_points).toHaveLength(8);
        expect(out.key_points[0]).toBe('p0');
        expect(out.therapist_advice).toEqual(['a']);
    });

    it('caps new problems, trims, and drops empty notes and titles', () => {
        const np = (title: string) => ({ title, description: ' d ', progress_note: ' n ' });
        const out = clampExtraction({
            problem_updates: [
                { problem_id: 1, progress_note: '  ok  ', suggested_status: 'active' },
                { problem_id: 2, progress_note: '   ', suggested_status: 'active' },
            ],
            new_problems: [np('A'), np('B'), np(' '), np('C'), np('D')],
        });
        expect(out.problem_updates).toEqual([{ problem_id: 1, progress_note: 'ok', suggested_status: 'active' }]);
        expect(out.new_problems.map((p) => p.title)).toEqual(['A', 'B', 'C']);
        expect(out.new_problems.length).toBeLessThanOrEqual(MAX_NEW_PROBLEMS);
        expect(out.new_problems[0]).toEqual({ title: 'A', description: 'd', progress_note: 'n' });
    });
});

describe('prompts', () => {
    it('summarize prompt carries the guidance that matters: David’s framing, speaker inference, no invention', () => {
        expect(SUMMARIZE_SYSTEM).toContain('David');
        expect(SUMMARIZE_SYSTEM).toMatch(/Speaker 0/);
        expect(SUMMARIZE_SYSTEM).toMatch(/Never invent/);
        expect(SUMMARIZE_SYSTEM).toMatch(/under 50 characters/);
        expect(SUMMARIZE_SYSTEM).toMatch(/only things David actually said/);
        expect(SUMMARIZE_SYSTEM).toMatch(/Never firm up a fragmentary note/);
        expect(SUMMARIZE_SYSTEM.split('\n').length).toBeLessThan(200);
    });

    it('map prompt carries the mapping rules from the spec', () => {
        expect(MAP_PROBLEMS_SYSTEM).toMatch(/Prefer updating to creating/);
        expect(MAP_PROBLEMS_SYSTEM).toMatch(/durable theme/);
        expect(MAP_PROBLEMS_SYSTEM).toMatch(/1 to 3 sentences/);
        expect(MAP_PROBLEMS_SYSTEM).toMatch(/clearly closes/);
        expect(MAP_PROBLEMS_SYSTEM).toMatch(/practice, tool or assignment.*never a problem/);
        expect(MAP_PROBLEMS_SYSTEM).toMatch(/distinct from general anxiety/);
        expect(MAP_PROBLEMS_SYSTEM).toMatch(/most specific matching problem/);
        expect(MAP_PROBLEMS_SYSTEM).toMatch(/at most six words/);
    });

    it('builds the user messages with the date, the kind of source and the evidence', () => {
        const transcript = buildSummarizeMessage({ occurred_at: '2026-09-11T16:00:00.000Z', kind: 'transcript', text: '[00:00] Speaker 0: hi', title_hint: null, context: 'CTX' });
        expect(transcript).toContain('Fri Sep 11, 2026');
        expect(transcript).toContain('kind="TRANSCRIPT"');
        expect(transcript).toContain('CTX');
        const none = buildMapMessage({ occurred_at: '2026-09-11T16:00:00.000Z', summary: { ...SUMMARY, therapist_advice: [] }, problems_context: '# Existing problems' });
        expect(none).toContain('(none)');
    });
});

describe('transcript formatting', () => {
    const u = (speaker: number, transcript: string, start: number, end = start + 1): Utterance => ({ speaker, transcript, start, end });

    it('merges consecutive same-speaker utterances into one turn at the first start time', () => {
        const turns = mergeTurns([u(0, 'a', 0), u(0, 'b', 2), u(1, 'c', 4), u(0, 'd', 6)]);
        expect(turns.map((t) => [t.speaker, t.transcript, t.start])).toEqual([
            [0, 'a b', 0],
            [1, 'c', 4],
            [0, 'd', 6],
        ]);
    });

    it('formats [mm:ss] Speaker N lines, rolling minutes over, and does not mutate its input', () => {
        const input = [u(1, 'Tell me more.', 61.9), u(1, 'What happened next?', 65), u(0, 'I froze.', 3725)];
        expect(buildTranscript(input)).toBe('[01:01] Speaker 1: Tell me more. What happened next?\n[62:05] Speaker 0: I froze.');
        expect(input[0]!.transcript).toBe('Tell me more.');
        expect(buildTranscript([])).toBe('');
    });
});
