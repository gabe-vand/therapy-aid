import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as repo_updates from '@/repositories/problem-updates';
import * as repo_problems from '@/repositories/problems';
import * as repo_sessions from '@/repositories/sessions';
import * as svc_claude from '@/services/common/svc-claude';
import { SessionStateError } from '@/services/sessions/errors';
import { describeFailure, pipelineIdle, processSession, retrySession } from '@/services/sessions/pipeline';
import { clearRecordings, stubClaude, stubFocus, SUMMARY, uploadedNotes, tracker } from './fixtures';
import { resetDatabase, seedProblem } from '../../helpers/hlp-db';

// Failure paths: a failed call lands on the row as a readable error, and Retry resumes at the step that failed.

const { track, restore } = tracker();

beforeEach(() => {
    resetDatabase();
    clearRecordings();
    track(spyOn(console, 'log').mockImplementation(() => {}));
    track(spyOn(console, 'warn').mockImplementation(() => {}));
    track(spyOn(console, 'error').mockImplementation(() => {}));
});
afterEach(restore);

describe('processSession: failures and retry', () => {
    it('records a readable error and status failed when summarize fails, and never throws', async () => {
        track(spyOn(svc_claude, 'completeStructured').mockRejectedValue(new svc_claude.AiRefusalError()));
        const focus = track(stubFocus());
        const session = uploadedNotes();

        await expect(processSession(session.id)).resolves.toBeUndefined();

        const row = repo_sessions.selectSessionById(session.id)!;
        expect(row.status).toBe('failed');
        expect(row.error).toContain('declined');
        expect(row.summary_json).toBeNull();
        expect(focus).not.toHaveBeenCalled();
    });

    it('turns an unconfigured AI key into the clear message', async () => {
        track(stubFocus());
        const session = uploadedNotes();
        await processSession(session.id); // no stub: the test env has no ANTHROPIC_API_KEY
        const row = repo_sessions.selectSessionById(session.id)!;
        expect(row.status).toBe('failed');
        expect(row.error).toContain('ANTHROPIC_API_KEY');
    });

    it('summarize succeeded but map_problems failed: retry skips the summarize call and finishes', async () => {
        track(stubFocus());
        const fail = track(
            spyOn(svc_claude, 'completeStructured').mockImplementation((async (opts: { task: string }) => {
                if (opts.task === 'summarize') return SUMMARY;
                throw new svc_claude.AiOutputError('The AI reply was cut off.');
            }) as never),
        );
        const session = uploadedNotes();
        await processSession(session.id);
        expect(repo_sessions.selectSessionById(session.id)!.status).toBe('failed');
        expect(repo_sessions.selectSessionById(session.id)!.summary_json).not.toBeNull();
        fail.mockRestore();

        const claude = track(stubClaude({ problem_updates: [], new_problems: [{ title: 'Morning structure', description: 'd', progress_note: 'n' }] }));
        const retried = retrySession(session.id);
        expect(retried.status).toBe('uploaded');
        expect(retried.error).toBeNull();
        await pipelineIdle();

        expect(claude.tasks()).toEqual(['map_problems']);
        expect(repo_sessions.selectSessionById(session.id)!.status).toBe('ready');
        expect(repo_updates.selectUpdatesForSession(session.id)).toHaveLength(1);
    });

    it('re-running a finished session replaces its notes instead of doubling them', async () => {
        const problem = seedProblem();
        track(stubClaude({ problem_updates: [{ problem_id: problem.id, progress_note: 'Note A', suggested_status: 'active' }], new_problems: [{ title: 'New theme', description: 'd', progress_note: 'n' }] }));
        track(stubFocus());
        const session = uploadedNotes();
        await processSession(session.id);
        repo_sessions.updateSession(session.id, { status: 'failed', error: 'forced' });

        retrySession(session.id);
        await pipelineIdle();

        expect(repo_updates.selectUpdatesForSession(session.id)).toHaveLength(2);
        expect(repo_problems.selectProblemsByStatus(['active']).filter((p) => p.title === 'New theme')).toHaveLength(1);
    });

    it('retrySession refuses anything that is not failed, and unknown ids', () => {
        const session = uploadedNotes();
        expect(() => retrySession(session.id)).toThrow(SessionStateError);
        expect(() => retrySession(9999)).toThrow(/not found/);
    });
});

describe('describeFailure', () => {
    it('keeps AI and transcription messages, hides SDK payloads behind a plain sentence', () => {
        expect(describeFailure(new svc_claude.AiNotConfiguredError())).toContain('ANTHROPIC_API_KEY');
        expect(describeFailure(Object.assign(new Error('529 {"type":"error"}'), { status: 529 }))).toBe('The AI service is busy or unavailable right now (HTTP 529). Press Retry in a minute.');
        expect(describeFailure(Object.assign(new Error('400 bad'), { status: 400 }))).toBe('The AI service rejected the request (HTTP 400).');
        expect(describeFailure(new TypeError('boom'))).toBe('Processing failed: boom');
        expect(describeFailure('weird')).toBe('Processing failed for an unknown reason.');
    });
});
