import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as repo_problems from '@/repositories/problems';
import * as repo_sessions from '@/repositories/sessions';
import * as svc_claude from '@/services/common/svc-claude';
import { processSession } from '@/services/sessions/pipeline';
import { patchSession } from '@/services/sessions/sessions';
import { clearRecordings, EMPTY_EXTRACTION, stubFocus, SUMMARY, tracker, uploadedNotes } from './fixtures';
import { resetDatabase } from '../../helpers/hlp-db';

// Edits made on the session page WHILE the pipeline awaits an AI call: the pipeline must not write
// back the stale row it captured before the await.

const { track, restore } = tracker();
const NEW_DATE = '2026-09-18T16:00:00.000Z';

beforeEach(() => {
    resetDatabase();
    clearRecordings();
    track(stubFocus());
    track(spyOn(console, 'log').mockImplementation(() => {}));
    track(spyOn(console, 'error').mockImplementation(() => {}));
});
afterEach(restore);

/** Claude stubbed by task; `during` runs inside the named call, as a PATCH would land mid-request. */
const claudeWith = (during: { summarize?: (id: number) => void; map_problems?: (id: number) => void }, id: () => number) =>
    spyOn(svc_claude, 'completeStructured').mockImplementation((async (opts: { task: 'summarize' | 'map_problems' }) => {
        during[opts.task]?.(id());
        if (opts.task === 'summarize') return SUMMARY;
        return { ...EMPTY_EXTRACTION, new_problems: [{ title: 'Morning structure', description: 'd', progress_note: 'n' }] };
    }) as never);

describe('processSession with edits during processing', () => {
    it('keeps a title the user typed while summarize was running', async () => {
        const session = uploadedNotes();
        track(claudeWith({ summarize: (id) => patchSession(id, { title: 'Week 7 - my rename' }) }, () => session.id));
        await processSession(session.id);
        const row = repo_sessions.selectSessionById(session.id)!;
        expect(row.status).toBe('ready');
        expect(row.title).toBe('Week 7 - my rename');
    });

    it('still uses the AI title when nothing was typed', async () => {
        const session = uploadedNotes();
        track(claudeWith({}, () => session.id));
        await processSession(session.id);
        expect(repo_sessions.selectSessionById(session.id)!.title).toBe(SUMMARY.title);
    });

    it('dates the problem notes with a date edited while the mapping call ran', async () => {
        const session = uploadedNotes();
        track(claudeWith({ map_problems: (id) => patchSession(id, { occurred_at: NEW_DATE }) }, () => session.id));
        await processSession(session.id);
        const opened = repo_problems.selectProblemsByStatus(['active']).find((p) => p.title === 'Morning structure')!;
        expect(opened.last_discussed_at).toBe(NEW_DATE);
    });
});
