// Shared fixtures for the sessions tests: a stubbed Claude that answers by task (never the
// network), a stubbed focus refresh, and helpers for writing audio and clearing the recordings dir.
// Not a *.test.ts file, so bun does not run it.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spyOn } from 'bun:test';
import type { SessionSummary } from '@therapy-aid/shared';
import type { SessionRow } from '@/repositories/sessions';
import * as repo_sessions from '@/repositories/sessions';
import * as svc_claude from '@/services/common/svc-claude';
import { app_env } from '@/services/common/svc-env';
import * as svc_focus from '@/services/focus/focus';
import { recordingDir } from '@/services/sessions/audio-files';
import type { ProblemExtraction } from '@/services/sessions/prompts-map';

export const SUMMARY: SessionSummary = {
    title: 'Racing mind, ADHD, morning structure',
    overview: 'David and Gabe talked about the racing mind at night and how mornings fall apart without an anchor.',
    key_points: ['Racing thoughts peak after 11pm', 'Mornings have no anchor'],
    therapist_advice: ['Write a worry list before bed', 'Keep the same wake time every day'],
};

export const EMPTY_EXTRACTION: ProblemExtraction = { problem_updates: [], new_problems: [] };

export type ClaudeStub = ReturnType<typeof stubClaude>;

/** completeStructured answers `summarize` and `map_problems` with the given values; any other
    task fails the test. `calls` records every call's task and user message in order. */
export const stubClaude = (extraction: ProblemExtraction = EMPTY_EXTRACTION, summary: SessionSummary = SUMMARY) => {
    const calls: { task: string; user: string }[] = [];
    const spy = spyOn(svc_claude, 'completeStructured').mockImplementation((async (opts: { task: string; messages: { content: unknown }[] }) => {
        calls.push({ task: opts.task, user: String(opts.messages[0]!.content) });
        if (opts.task === 'summarize') return summary;
        if (opts.task === 'map_problems') return extraction;
        throw new Error(`unexpected AI task in a sessions test: ${opts.task}`);
    }) as never);
    return { spy, calls, tasks: () => calls.map((c) => c.task), mockRestore: () => spy.mockRestore() };
};

/** Stubs the focus refresh (owned by another module) so the pipeline's seam can be asserted. */
export const stubFocus = () => spyOn(svc_focus, 'regenerateFocus').mockResolvedValue({ id: 1, session_id: null, created_at: '2026-01-01T00:00:00.000Z', headline: 'Focus.', items: [], checkins: [] });

/** A session waiting to be processed. */
export const uploadedNotes = (over: Partial<repo_sessions.NewSessionRow> = {}): SessionRow =>
    repo_sessions.insertSession({ occurred_at: '2026-09-11T16:00:00.000Z', source: 'notes', status: 'uploaded', notes: 'We talked about my racing mind and the mornings.', ...over });

/** A finalised recording with an audio file on disk, waiting for transcription. */
export const uploadedRecording = (bytes = 'fake-audio-bytes'): SessionRow => {
    const row = repo_sessions.insertSession({ occurred_at: '2026-09-11T16:00:00.000Z', source: 'recording', status: 'recording', audio_mime: 'audio/webm' });
    mkdirSync(recordingDir(row.id), { recursive: true });
    const audio_path = join(recordingDir(row.id), 'audio.webm');
    writeFileSync(audio_path, bytes);
    return repo_sessions.updateSession(row.id, { status: 'uploaded', audio_path })!;
};

/** Empties the recordings dir between tests. */
export const clearRecordings = (): void => {
    mkdirSync(app_env.recordings_dir, { recursive: true });
    for (const name of readdirSync(app_env.recordings_dir)) rmSync(join(app_env.recordings_dir, name), { recursive: true, force: true });
};

/** Tracks spies so a file can restore them all in afterEach (stubClaude's result counts as one). */
export const tracker = () => {
    let spies: { mockRestore: () => void }[] = [];
    return {
        track: <T extends { mockRestore: () => void }>(spy: T): T => {
            spies.push(spy);
            return spy;
        },
        restore: (): void => {
            for (const s of spies) s.mockRestore();
            spies = [];
        },
    };
};
