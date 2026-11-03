// Seeds a running therapy-aid with Gabe's history: profile.md, journal.md and therapy-notes.md
// from seed-data/ (gitignored: personal data in a public repo). Run it from a dev machine, never
// on the Pi, over HTTP; the API does the real work (summaries, problem mapping, focus).
//
//   bun scripts/import-seed.ts --url https://therapy-aid.elephant-trench.ts.net --dir seed-data
//
// Safe to re-run: anything already imported (matched by calendar day) is skipped, and a session
// that failed last time is retried. Parsing lives in lib/seed-parse.ts, the steps in lib/seed-import.ts.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createApi } from './lib/seed-client';
import { importJournal, importProfile, importTherapyNotes, type ImportDeps } from './lib/seed-import';
import { apiBase, splitDated } from './lib/seed-parse';

const USAGE = `Usage: bun scripts/import-seed.ts [options]

  --url <url>          server to import into (default http://127.0.0.1:3010).
                       localhost uses bare paths; any other host gets /api appended.
  --dir <dir>          folder with profile.md, journal.md, therapy-notes.md (default seed-data)
  --only <list>        comma list of: profile, journal, notes (default all)
  --prefix <path>      force the path prefix ("" or "/api") instead of guessing from the host
  --overwrite-profile  replace a profile that was already edited in the app
  --timeout <minutes>  wait this long for each session to process (default 15)
  --dry-run            parse the files and print what would be sent; touch no server
  --help`;

const { values } = parseArgs({
    options: {
        url: { type: 'string', default: 'http://127.0.0.1:3010' },
        dir: { type: 'string', default: 'seed-data' },
        only: { type: 'string' },
        prefix: { type: 'string' },
        'overwrite-profile': { type: 'boolean', default: false },
        timeout: { type: 'string', default: '15' },
        'dry-run': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
    },
});

const log = (line: string) => console.log(line);
const fail = (message: string): never => {
    console.error(`import-seed: ${message}`);
    process.exit(1);
};

if (values.help) {
    log(USAGE);
    process.exit(0);
}

const steps = new Set((values.only ?? 'profile,journal,notes').split(',').map((s) => s.trim()));
const unknown = [...steps].filter((s) => !['profile', 'journal', 'notes'].includes(s));
if (unknown.length) fail(`unknown --only value: ${unknown.join(', ')}`);

/** Reads one seed file; a missing file is a clear stop for a requested step. */
const read = (name: string): string => {
    const path = join(values.dir!, name);
    if (!existsSync(path)) return fail(`${path} not found (use --dir to point at the seed folder)`);
    return readFileSync(path, 'utf8');
};

const profile = steps.has('profile') ? read('profile.md') : '';
const journal = steps.has('journal') ? read('journal.md') : '';
const notes = steps.has('notes') ? read('therapy-notes.md') : '';

// Parse up front so a malformed file stops the run before anything is sent.
let journal_count = 0;
let notes_count = 0;
try {
    journal_count = splitDated(journal).length;
    notes_count = splitDated(notes).length;
} catch (e) {
    fail(e instanceof Error ? e.message : String(e));
}

if (values['dry-run']) {
    if (steps.has('profile')) log(`profile    ${profile.trim().length} chars`);
    if (steps.has('journal')) log(`journal    ${journal_count} entries: ${splitDated(journal).map((e) => e.date).join(' ')}`);
    if (steps.has('notes')) log(`sessions   ${notes_count} notes: ${splitDated(notes).map((e) => e.date).join(' ')}`);
    log('dry run - nothing was sent.');
    process.exit(0);
}

const base = apiBase(values.url!, values.prefix);
const timeout_min = Number(values.timeout);
if (!(timeout_min > 0)) fail('--timeout must be a positive number of minutes');
const deps: ImportDeps = { api: createApi(base), log, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), timeout_ms: timeout_min * 60_000 };

try {
    const me = await deps.api.get<{ login: string }>('/me');
    log(`connected to ${base} as ${me.login}`);
    if (steps.has('profile')) await importProfile(deps, profile, values['overwrite-profile']!);
    if (steps.has('journal')) await importJournal(deps, journal);
    if (steps.has('notes') && !(await importTherapyNotes(deps, notes))) process.exit(1);
    log('all done.');
} catch (e) {
    fail(e instanceof Error ? e.message : String(e));
}
