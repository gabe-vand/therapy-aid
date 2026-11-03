// Margin notes: what happens when Gabe finishes a paragraph. The classifier always runs and,
// when confident, records a journal↔problem link (which Home and the problem pages read). A note
// is then written only when the SPA asked for one (`write`) and nothing blocks it: the entry
// already has a live note about that problem, the entry has reached its cap, or the day has.
// The note itself comes from narrow evidence (evidence.ts), never from the whole context pack.
import type { JournalInsight, MarginNoteResult } from '@therapy-aid/shared';
import * as repo_insights from '@/repositories/journal-insights';
import * as repo_journal from '@/repositories/journal';
import * as repo_sessions from '@/repositories/sessions';
import { AiOutputError, completeStructured, systemBlocks } from '@/services/common/svc-claude';
import { formatDay, truncateWords } from '@/services/context/format';
import { renderProfile } from '@/services/context/pack-sections';
import { getProfile } from '@/services/settings/settings';
import { classifyParagraph } from './classify';
import { buildNoteEvidence } from './evidence';
import { buildNoteMessage, NOTE_PERSONA, NoteSchema } from './prompts';

export const MAX_NOTES_PER_ENTRY = 5;
export const MAX_NOTES_PER_DAY = 40;
export const ANCHOR_CHARS = 80;
export const EXCERPT_CHARS = 160;
// A guard, not a target: the prompt asks for 25 to 60 words.
const MAX_WORDS = 90;

/** One line of plain text from a paragraph that may carry Markdown marks. */
export const plainParagraph = (paragraph: string): string =>
    paragraph
        .replace(/[*_~`#>]+/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();

export const toInsight = (row: repo_insights.JournalInsightWithProblem): JournalInsight => ({
    id: row.id,
    entry_id: row.entry_id,
    body: row.body,
    kind: row.kind,
    source: row.source,
    problem_id: row.problem_id,
    problem_title: row.problem_title,
    session_id: row.session_id,
    anchor: row.anchor,
    dismissed_at: row.dismissed_at,
    created_at: row.created_at,
});

const startOfTodayUtc = (): string => `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;

/** Classifies `paragraph` for `entry_id`; writes a note when asked and allowed. Null when the
    entry doesn't exist. AI failures throw (AiError) — the route turns them into messages. */
export const noteParagraph = async (entry_id: number, paragraph: string, write: boolean): Promise<MarginNoteResult | null> => {
    if (!repo_journal.selectJournalEntryById(entry_id)) return null;
    const plain = plainParagraph(paragraph);

    const match = await classifyParagraph(plain);
    if (!match) return { outcome: 'no_match', link: null, note: null };
    const { problem, confidence } = match;
    repo_insights.upsertJournalProblemLink({ entry_id, problem_id: problem.id, confidence, excerpt: plain.slice(0, EXCERPT_CHARS) });
    const link = { problem_id: problem.id, problem_title: problem.title, confidence };

    if (!write) return { outcome: 'skipped', link, note: null };
    if (repo_insights.hasMarginNoteFor(entry_id, problem.id)) return { outcome: 'duplicate', link, note: null };
    if (repo_insights.countMarginNotes(entry_id) >= MAX_NOTES_PER_ENTRY || repo_insights.countMarginNotesSince(startOfTodayUtc()) >= MAX_NOTES_PER_DAY) {
        return { outcome: 'capped', link, note: null };
    }

    const reply = await completeStructured({
        task: 'margin_note',
        system: systemBlocks([NOTE_PERSONA, renderProfile(getProfile().profile)]),
        messages: [{ role: 'user', content: buildNoteMessage({ today: formatDay(new Date().toISOString()), paragraph: plain, evidence: buildNoteEvidence(problem, plain) }) }],
        schema: NoteSchema,
        max_tokens: 600,
    });
    const body = truncateWords(reply.body, MAX_WORDS);
    if (!body) throw new AiOutputError('The AI reply was empty. Try again.');
    const session_id = reply.session_id !== null && repo_sessions.selectSessionById(reply.session_id) ? reply.session_id : null;

    const row = repo_insights.insertJournalInsight({ entry_id, body, kind: reply.kind, source: 'margin', problem_id: problem.id, session_id, anchor: plain.slice(0, ANCHOR_CHARS) });
    return { outcome: 'written', link, note: toInsight({ ...row, problem_title: problem.title }) };
};
