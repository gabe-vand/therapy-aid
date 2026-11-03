// The model eval (SPEC §13): runs the app's real prompts on Gabe's real notes for each candidate
// model, so routing in svc-models.ts TASK_MODELS is chosen on evidence, not assumed. No server, no
// database file, no HTTP: it imports the prompt builders and svc-claude directly and keeps the
// would-be rows in memory (lib/eval-world.ts). Reads seed-data/ (gitignored, personal) and writes
// eval-out/ (gitignored): eval-out/<model>/*.json|md, eval-out/costs.md and, with --judge,
// eval-out/judge.md. Costs real money: roughly 17 calls per model, plus ~11 Opus calls per judged
// model.
//
//   bun run eval                                   # all three models
//   bun run eval -- --models claude-haiku-5-5 --judge
//   bun run eval -- --judge-only                   # re-grade what is already in eval-out/
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { splitDated } from './lib/seed-parse';

// Before ANY backend module loads: svc-db opens its database at import time, and the eval must
// never touch a real one. Everything from the backend is imported dynamically below, after this.
// This WRITE is the one sanctioned process.env use outside svc-env.ts (the "read env only through
// app_env" rule): it has to happen before app_env exists. The test preload does the same.
process.env.DB_PATH = ':memory:';

const USAGE = `Usage: bun run eval -- [options]     (the root script loads backend/.env for ANTHROPIC_API_KEY)

  --models <list>   comma list of model ids to run (default: every id in MODEL_IDS, svc-models.ts)
  --effort <level>  force one effort (low|medium|high|xhigh|max) for every task;
                    default: each task's own effort from TASK_MODELS
  --judge           afterwards, have Opus grade every non-Opus model in eval-out/ against Opus
  --judge-only      skip the runs; just grade what eval-out/ already holds
  --seed <dir>      folder with profile.md, journal.md, therapy-notes.md (default seed-data)
  --out <dir>       output folder (default eval-out)
  --today <date>    YYYY-MM-DD the run treats as today (default: now)
  --help`;

const { values } = parseArgs({
    options: {
        models: { type: 'string' },
        effort: { type: 'string' },
        judge: { type: 'boolean', default: false },
        'judge-only': { type: 'boolean', default: false },
        seed: { type: 'string', default: 'seed-data' },
        out: { type: 'string', default: 'eval-out' },
        today: { type: 'string' },
        help: { type: 'boolean', default: false },
    },
});

const log = (line: string) => console.log(line);
const fail = (message: string): never => {
    console.error(`eval-models: ${message}`);
    process.exit(1);
};

if (values.help) {
    log(USAGE);
    process.exit(0);
}

const { app_env } = await import('../backend/src/services/common/svc-env');
const { EFFORTS, MODEL_IDS } = await import('../backend/src/services/common/svc-models');
const { runModel } = await import('./lib/eval-run');
const { runJudge } = await import('./lib/eval-judge');
const { renderCosts } = await import('./lib/eval-report');
type ModelUsage = import('./lib/eval-report').ModelUsage;

if (!app_env.anthropic_api_key) fail('ANTHROPIC_API_KEY is not set (put it in backend/.env, or export it)');
const effort = values.effort ? (EFFORTS.find((e) => e === values.effort) ?? fail(`--effort must be one of ${EFFORTS.join('|')}`)) : undefined;
// The default candidates come from MODEL_IDS, so a model bump in svc-models.ts reaches the eval too.
const models = (values.models ?? Object.values(MODEL_IDS).join(','))
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
if (models.length === 0) fail('--models is empty');
if (values.today && !/^\d{4}-\d{2}-\d{2}$/.test(values.today)) fail('--today must be YYYY-MM-DD');
const today = values.today ? new Date(`${values.today}T12:00:00`).toISOString() : new Date().toISOString();

/** Reads one seed file; a missing one stops the run before anything is spent. */
const read = (name: string): string => {
    const path = join(values.seed!, name);
    if (!existsSync(path)) return fail(`${path} not found (use --seed to point at the seed folder)`);
    return readFileSync(path, 'utf8');
};
const seed = { profile: read('profile.md'), notes: splitDated(read('therapy-notes.md')), journal: splitDated(read('journal.md')) };
if (seed.notes.length === 0) fail('therapy-notes.md has no "## YYYY-MM-DD" entries');
const out_dir = values.out!;

if (!values['judge-only']) {
    log(`eval: ${seed.notes.length} sessions, ${seed.journal.length} journal entries, models ${models.join(', ')}`);
    for (const model of models) await runModel(seed, { model, effort, today, out_dir, log });

    // costs.md covers every model with output in eval-out/, so a partial re-run keeps the others.
    const usage: ModelUsage[] = readdirSync(out_dir)
        .map((name) => join(out_dir, name, 'usage.json'))
        .filter((path) => existsSync(path))
        .map((path) => JSON.parse(readFileSync(path, 'utf8')) as ModelUsage);
    writeFileSync(join(out_dir, 'costs.md'), renderCosts(usage, new Date().toISOString()));
    log(`eval: wrote ${join(out_dir, 'costs.md')}`);
}

if (values.judge || values['judge-only']) {
    const candidates = existsSync(out_dir) ? readdirSync(out_dir).filter((name) => name !== MODEL_IDS.opus && existsSync(join(out_dir, name, 'usage.json'))) : [];
    if (candidates.length === 0) fail(`nothing to judge in ${out_dir} (run a non-Opus model first)`);
    await runJudge(seed, { out_dir, reference: MODEL_IDS.opus, candidates, log }).catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
}
log('eval: done. Read the raw outputs too; the judge is an aid, not the decision.');
