// "I have an idea…": on click, saves the draft as the entry body, then asks Claude for a short
// note that connects it to Gabe's therapy. Never runs on its own. The draft is saved FIRST so a
// failed AI call (no key, refusal, network) never loses what he typed. The context pack is built
// WITHOUT this entry: the draft is already in the user message, and leaving it in the cached
// system block would change that block on every click and miss the prompt cache each time.
import type { JournalInsight } from '@therapy-aid/shared';
import * as repo_journal from '@/repositories/journal';
import * as repo_insights from '@/repositories/journal-insights';
import { AiOutputError, completeStructured, systemBlocks } from '@/services/common/svc-claude';
import { buildContextPack } from '@/services/context/context-pack';
import { formatDay, truncateWords } from '@/services/context/format';
import { journalSearchDocument, reindexJournalEntry } from '@/services/search/search';
import { INSIGHT_PERSONA, InsightSchema, buildInsightMessage } from './prompts';

const OTHER_ENTRIES = 3;
// A guard, not a target: the prompt asks for 80 to 180 words.
const MAX_WORDS = 350;

/** Saves `draft`, generates and stores one insight. Null when the entry doesn't exist. */
export const generateInsight = async (entry_id: number, draft: string): Promise<JournalInsight | null> => {
    const saved = repo_journal.updateJournalEntry(entry_id, { body: draft });
    if (!saved) return null;
    reindexJournalEntry(saved);

    const others = repo_journal
        .selectJournalEntries(OTHER_ENTRIES, entry_id)
        .map((row) => `- ${formatDay(row.occurred_at)} [entry #${row.id}]: ${journalSearchDocument(row).title}`);

    const { body } = await completeStructured({
        task: 'insight',
        system: systemBlocks([INSIGHT_PERSONA, buildContextPack({ exclude_entry_id: entry_id })]),
        messages: [{ role: 'user', content: buildInsightMessage({ today: formatDay(new Date().toISOString()), entry_id, entry_day: formatDay(saved.occurred_at), draft, others }) }],
        schema: InsightSchema,
    });
    const note = truncateWords(body, MAX_WORDS);
    if (!note) throw new AiOutputError('The AI reply was empty. Try again.');
    return repo_insights.insertJournalInsight({ entry_id, body: note });
};
