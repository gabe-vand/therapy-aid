// Classifies the paragraphs of existing journal entries against the saved problems, so "In your
// journal lately" (Home) and "In your journal" (a problem's page) are filled in for history
// written before margin notes existed. Links only: nothing is written beside the entries
// (`write: false`), so it costs the classifier alone (Haiku, a fraction of a cent per paragraph).
// Runs from a dev machine over HTTP, like import-seed.ts; safe to re-run (links are upserted).
//
//   bun scripts/classify-journal.ts --url https://therapy-aid.elephant-trench.ts.net
import { parseArgs } from 'node:util';
import type { JournalEntry, MarginNoteResult } from '@therapy-aid/shared';
import { createApi } from './lib/seed-client';
import { apiBase } from './lib/seed-parse';

const USAGE = `Usage: bun scripts/classify-journal.ts [options]

  --url <url>       server (default http://127.0.0.1:3010); non-local hosts get /api appended
  --prefix <path>   force the path prefix ("" or "/api") instead of guessing from the host
  --min <chars>     skip paragraphs shorter than this (default 60)
  --limit <n>       only the newest n entries
  --dry-run         list what would be sent; touch no AI
  --help`;

const { values } = parseArgs({
    options: {
        url: { type: 'string', default: 'http://127.0.0.1:3010' },
        prefix: { type: 'string' },
        min: { type: 'string', default: '60' },
        limit: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
    },
});

if (values.help) {
    console.log(USAGE);
    process.exit(0);
}

const MIN = Number(values.min);
const strip = (line: string): string =>
    line
        .trim()
        .replace(/^(?:>\s*)+/, '')
        .replace(/^(?:[-*+]|\d+[.)])\s+/, '')
        .replace(/[*_~`]+/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .trim();

/** The paragraphs of a Markdown body as plain text (headings and rules dropped). */
export const paragraphsOf = (markdown: string): string[] =>
    markdown
        .split(/\n[ \t]*\n/)
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk && !/^#{1,6}\s/.test(chunk) && !/^(?:[-*_]\s*){3,}$/.test(chunk))
        .map((chunk) => chunk.split('\n').map(strip).filter(Boolean).join(' ').replace(/\s+/g, ' '))
        .filter((text) => text.length >= MIN);

const main = async () => {
    const api = createApi(apiBase(values.url!, values.prefix));
    const entries = await api.get<JournalEntry[]>('/journal');
    const chosen = values.limit ? entries.slice(0, Number(values.limit)) : entries;
    let sent = 0;
    let linked = 0;
    for (const entry of chosen) {
        const paragraphs = paragraphsOf(entry.body);
        console.log(`entry #${entry.id} (${entry.occurred_at.slice(0, 10)}): ${paragraphs.length} paragraph${paragraphs.length === 1 ? '' : 's'}`);
        if (values['dry-run']) continue;
        for (const paragraph of paragraphs) {
            const result = await api.post<MarginNoteResult>(`/journal/${entry.id}/notes`, { paragraph: paragraph.slice(0, 4000), write: false });
            sent += 1;
            if (result.link) {
                linked += 1;
                console.log(`  -> ${result.link.problem_title} (${result.link.confidence.toFixed(2)})`);
            }
        }
    }
    console.log(values['dry-run'] ? 'dry run: nothing sent' : `done: ${sent} paragraphs classified, ${linked} linked`);
};

main().catch((e) => {
    console.error(`classify-journal: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
});
