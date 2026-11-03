// Chat retrieval for the model eval: the REAL search (services/search, FTS5 with the real
// tokenizer, sanitizer, bm25 weights and snippets) over a throwaway in-memory index, plus the three
// chat tools answered from the eval's world instead of the repositories. eval-models.ts forces
// DB_PATH=':memory:' before anything opens svc-db; ensureIndex refuses to run otherwise, so the
// eval can never write into a real database file.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JournalEntryRow } from '../../backend/src/repositories/journal';
import type { SessionRow } from '../../backend/src/repositories/sessions';
import { sqlite } from '../../backend/src/services/common/svc-db';
import { app_env } from '../../backend/src/services/common/svc-env';
import { formatExcerpt } from '../../backend/src/services/chat/prompts';
import { formatDay } from '../../backend/src/services/context/format';
import { parseSessionSummary } from '../../backend/src/services/context/session-summary';
import { journalSearchDocument, reindexDocument, searchDocuments, sessionSearchDocument } from '../../backend/src/services/search/search';
import type { World } from './eval-world';

const DDL = join(import.meta.dir, '..', '..', 'backend', 'db-schemas', '011.search_index.sql');
const SEARCH_LIMIT = 8;

let ready = false;

/** Creates the FTS5 table in the in-memory database (once). */
const ensureIndex = (): void => {
    if (ready) return;
    if (app_env.db_path !== ':memory:') throw new Error(`eval: refusing to index into ${app_env.db_path}; DB_PATH must be :memory:`);
    sqlite.exec(readFileSync(DDL, 'utf8'));
    ready = true;
};

/** Re-indexes every session and journal entry of `world` (each model's summaries differ). */
export const indexWorld = (world: World): void => {
    ensureIndex();
    sqlite.exec('delete from search_index');
    // sessionSearchDocument reads only id, occurred_at, title, summary_json, notes and transcript.
    for (const s of world.sessions) reindexDocument(sessionSearchDocument({ ...s, transcript: null } as unknown as SessionRow));
    for (const e of world.journal) reindexDocument(journalSearchDocument(e));
};

export { searchDocuments };

const readSession = (world: World, id: number): string => {
    const row = world.sessions.find((s) => s.id === id);
    if (!row) throw new Error(`There is no session #${id}.`);
    const summary = parseSessionSummary(row.summary_json);
    const parts = [`# ${row.title ?? summary?.title ?? 'Untitled session'} [session #${row.id}], ${formatDay(row.occurred_at)}`];
    if (summary?.overview.trim()) parts.push(`## Summary\n${summary.overview.trim()}`);
    if (summary?.key_points.length) parts.push(`## Key points\n${summary.key_points.map((p) => `- ${p}`).join('\n')}`);
    if (summary?.therapist_advice.length) parts.push(`## What David suggested\n${summary.therapist_advice.map((p) => `- ${p}`).join('\n')}`);
    parts.push(`## Notes\n${row.notes.trim()}`);
    return parts.join('\n\n');
};

const readEntry = (world: World, id: number): string => {
    const row: JournalEntryRow | undefined = world.journal.find((e) => e.id === id);
    if (!row) throw new Error(`There is no journal entry #${id}.`);
    return `# Journal entry [entry #${row.id}], ${formatDay(row.occurred_at)}\n\n${row.body.trim() || '(Empty entry.)'}`;
};

const intField = (input: unknown, key: string): number => {
    const value = (input as Record<string, unknown> | null)?.[key];
    if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`Invalid tool input: ${key} must be an integer`);
    return value;
};

/** runChatTool, answered from `world`. Throws on a bad id or input, as the real one does. */
export const runEvalTool =
    (world: World) =>
    async (name: string, input: unknown): Promise<string> => {
        if (name === 'search_notes') {
            const { query, kind } = (input ?? {}) as { query?: unknown; kind?: unknown };
            if (typeof query !== 'string' || !query.trim()) throw new Error('Invalid tool input: query is required');
            const hits = searchDocuments(query, { kind: kind === 'session' || kind === 'journal' ? kind : undefined, limit: SEARCH_LIMIT });
            return hits.length ? hits.map(formatExcerpt).join('\n') : `No matches for "${query}". Try different or fewer keywords.`;
        }
        if (name === 'read_session') return readSession(world, intField(input, 'session_id'));
        if (name === 'read_journal_entry') return readEntry(world, intField(input, 'entry_id'));
        throw new Error(`Unknown tool: ${name}`);
    };
