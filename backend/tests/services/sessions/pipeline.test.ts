import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as repo_updates from '@/repositories/problem-updates';
import * as repo_problems from '@/repositories/problems';
import * as repo_sessions from '@/repositories/sessions';
import * as svc_claude from '@/services/common/svc-claude';
import * as svc_focus from '@/services/focus/focus';
import { searchDocuments } from '@/services/search/search';
import { processSession } from '@/services/sessions/pipeline';
import { clearRecordings, EMPTY_EXTRACTION, stubClaude, stubFocus, SUMMARY, uploadedNotes, tracker } from './fixtures';
import { resetDatabase, seedProblem } from '../../helpers/hlp-db';

// The happy path of the pipeline for notes sessions on an in-memory database with Claude and the focus refresh stubbed.

const { track, restore } = tracker();

beforeEach(() => {
    resetDatabase();
    clearRecordings();
    track(spyOn(console, 'log').mockImplementation(() => {}));
    track(spyOn(console, 'warn').mockImplementation(() => {}));
    track(spyOn(console, 'error').mockImplementation(() => {}));
});
afterEach(restore);

describe('processSession: notes', () => {
    it('runs summarize then map_problems, writes the problems, refreshes focus and ends ready', async () => {
        const claude = track(
            stubClaude({
                problem_updates: [{ problem_id: seedProblem({ title: 'Racing mind at night' }).id, progress_note: 'Worse this week; David suggested a worry list.', suggested_status: 'active' }],
                new_problems: [{ title: 'Morning structure', description: 'Mornings have no anchor.', progress_note: 'First time this came up.' }],
            }),
        );
        const focus = track(stubFocus());
        const session = uploadedNotes();

        await processSession(session.id);

        const row = repo_sessions.selectSessionById(session.id)!;
        expect(row.status).toBe('ready');
        expect(row.error).toBeNull();
        expect(row.title).toBe(SUMMARY.title);
        expect(JSON.parse(row.summary_json!)).toEqual(SUMMARY);
        expect(claude.spy.mock.calls.map((c) => (c[0] as { task: string }).task)).toEqual(['summarize', 'map_problems']);
        expect(focus.mock.calls[0]).toEqual([session.id]);

        const updates = repo_updates.selectUpdatesForSession(session.id);
        expect(updates.map((u) => u.problem_title)).toEqual(['Racing mind at night', 'Morning structure']);
        const opened = repo_problems.selectProblemsByStatus(['active']).find((p) => p.title === 'Morning structure')!;
        expect(opened.origin_session_id).toBe(session.id);
        expect(opened.last_discussed_at).toBe(session.occurred_at);
        expect(searchDocuments('worry list')[0]?.ref_id).toBe(session.id);
    });

    it('hands the summarizer the notes and context, and the mapper the summary and problem ids — not the notes', async () => {
        const claude = track(stubClaude());
        track(stubFocus());
        const problem = seedProblem({ title: 'Racing mind at night' });
        const session = uploadedNotes({ notes: 'UNIQUE-NOTES-TEXT about sleep.' });

        await processSession(session.id);

        const [summarize, map] = claude.calls;
        expect(summarize!.user).toContain('UNIQUE-NOTES-TEXT');
        expect(summarize!.user).toContain(`[problem #${problem.id}]`);
        expect(map!.user).toContain(SUMMARY.overview);
        expect(map!.user).toContain(`[problem #${problem.id}]`);
        expect(map!.user).not.toContain('UNIQUE-NOTES-TEXT');
    });

    it('keeps a title the user supplied instead of the summary title', async () => {
        track(stubClaude());
        track(stubFocus());
        const session = uploadedNotes({ title: 'Week 3' });
        await processSession(session.id);
        expect(repo_sessions.selectSessionById(session.id)!.title).toBe('Week 3');
    });

    it('a focus failure does not undo a ready session', async () => {
        track(stubClaude());
        track(spyOn(svc_focus, 'regenerateFocus').mockRejectedValue(new Error('focus is down')));
        const session = uploadedNotes();
        await processSession(session.id);
        expect(repo_sessions.selectSessionById(session.id)!.status).toBe('ready');
    });

    it('moves through summarizing before it is ready', async () => {
        track(stubFocus());
        const seen: string[] = [];
        const id = uploadedNotes().id;
        track(
            spyOn(svc_claude, 'completeStructured').mockImplementation((async (opts: { task: string }) => {
                seen.push(`${opts.task}:${repo_sessions.selectSessionById(id)!.status}`);
                return opts.task === 'summarize' ? SUMMARY : EMPTY_EXTRACTION;
            }) as never),
        );
        await processSession(id);
        expect(seen).toEqual(['summarize:summarizing', 'map_problems:summarizing']);
        expect(repo_sessions.selectSessionById(id)!.status).toBe('ready');
    });
});
