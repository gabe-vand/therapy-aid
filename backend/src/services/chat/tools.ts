// The three retrieval tools chat can call: search_notes, read_session, read_journal_entry. The
// definitions are what the model sees; runChatTool validates its input with zod and answers from
// the real repositories. A bad id or bad input THROWS: completeWithTools turns a throw into an
// is_error tool_result, which is how the model learns it asked for something that doesn't exist.
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import * as repo_journal from '@/repositories/journal';
import * as repo_sessions from '@/repositories/sessions';
import { formatDay } from '@/services/context/format';
import { parseSessionSummary } from '@/services/context/session-summary';
import { searchDocuments } from '@/services/search/search';
import { formatExcerpt } from './prompts';

// A long therapy hour is ~50k characters of transcript; anything past this is cut with a note.
const MAX_BODY_CHARS = 60_000;
const SEARCH_LIMIT = 8;

export const CHAT_TOOLS: Anthropic.Tool[] = [
    {
        name: 'search_notes',
        description: "Full-text search over all of Gabe's therapy sessions (summaries, notes, transcripts) and journal entries. Returns the best matches with a snippet, date and id. Use plain keywords, not a sentence.",
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Keywords to look for, e.g. "racing mind sleep".' },
                kind: { type: 'string', enum: ['session', 'journal'], description: 'Restrict to therapy sessions or journal entries. Omit to search both.' },
            },
            required: ['query'],
        },
    },
    {
        name: 'read_session',
        description: 'The full record of one therapy session: summary, what David suggested, and the raw notes or transcript. Use the number from a [session #N] handle.',
        input_schema: { type: 'object', properties: { session_id: { type: 'integer', description: 'The session id.' } }, required: ['session_id'] },
    },
    {
        name: 'read_journal_entry',
        description: 'One journal entry in full. Use the number from an [entry #N] handle.',
        input_schema: { type: 'object', properties: { entry_id: { type: 'integer', description: 'The journal entry id.' } }, required: ['entry_id'] },
    },
];

const SearchInput = z.object({ query: z.string().min(1, 'query is required'), kind: z.enum(['session', 'journal']).nullish() });
const SessionInput = z.object({ session_id: z.number().int('session_id must be an integer') });
const EntryInput = z.object({ entry_id: z.number().int('entry_id must be an integer') });

const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
    const result = schema.safeParse(input);
    if (!result.success) throw new Error(`Invalid tool input: ${result.error.issues[0]?.message ?? 'bad input'}`);
    return result.data;
};

const clip = (text: string): string => (text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}\n\n[… cut: ${text.length - MAX_BODY_CHARS} more characters not shown. Use search_notes for a specific passage.]` : text);

const searchNotes = (input: unknown): string => {
    const { query, kind } = parse(SearchInput, input);
    const hits = searchDocuments(query, { kind: kind ?? undefined, limit: SEARCH_LIMIT });
    return hits.length ? hits.map(formatExcerpt).join('\n') : `No matches for "${query}". Try different or fewer keywords.`;
};

const readSession = (input: unknown): string => {
    const { session_id } = parse(SessionInput, input);
    const row = repo_sessions.selectSessionById(session_id);
    if (!row) throw new Error(`There is no session #${session_id}.`);
    const summary = parseSessionSummary(row.summary_json);
    const parts = [`# ${row.title ?? summary?.title ?? 'Untitled session'} [session #${row.id}], ${formatDay(row.occurred_at)}`];
    if (summary?.overview.trim()) parts.push(`## Summary\n${summary.overview.trim()}`);
    if (summary?.key_points.length) parts.push(`## Key points\n${summary.key_points.map((p) => `- ${p}`).join('\n')}`);
    if (summary?.therapist_advice.length) parts.push(`## What David suggested\n${summary.therapist_advice.map((p) => `- ${p}`).join('\n')}`);
    if (row.notes?.trim()) parts.push(`## Notes\n${clip(row.notes.trim())}`);
    if (row.transcript?.trim()) parts.push(`## Transcript\n${clip(row.transcript.trim())}`);
    if (parts.length === 1) parts.push('(This session has no summary, notes or transcript yet.)');
    return parts.join('\n\n');
};

const readJournalEntry = (input: unknown): string => {
    const { entry_id } = parse(EntryInput, input);
    const row = repo_journal.selectJournalEntryById(entry_id);
    if (!row) throw new Error(`There is no journal entry #${entry_id}.`);
    return `# Journal entry [entry #${row.id}], ${formatDay(row.occurred_at)}\n\n${clip(row.body.trim()) || '(Empty entry.)'}`;
};

/** Runs one tool call for the loop in completeWithTools. Throws on an unknown tool, bad input or
    a missing id. */
export const runChatTool = async (name: string, input: unknown): Promise<string> => {
    if (name === 'search_notes') return searchNotes(input);
    if (name === 'read_session') return readSession(input);
    if (name === 'read_journal_entry') return readJournalEntry(input);
    throw new Error(`Unknown tool: ${name}`);
};
