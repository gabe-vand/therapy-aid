// --judge: Opus grades each cheaper model's eval output against Opus's own, item by item (each
// session's summary + problem mapping, the focus, the insight, each chat answer), with the raw
// seed material as ground truth. The persona and the source material are two cached system
// blocks, so every judge call after the first reads them at the cache price. The judge has no
// AiTask of its own; it is billed under 'focus' (the Opus judgment task) and its usage is reset
// around it so it never mixes into costs.md.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as svc_claude from '../../backend/src/services/common/svc-claude';
import { getAiUsage, resetAiUsage } from '../../backend/src/services/common/svc-claude-usage';
import { MODEL_IDS } from '../../backend/src/services/common/svc-models';
import { PACK_JOURNAL_ENTRIES } from '../../backend/src/services/context/context-pack';
import { parseJudgeReply, renderJudge, type JudgedItem } from './eval-report';
import type { Seed } from './eval-world';

export const JUDGE_MODEL = MODEL_IDS.opus;

const JUDGE_PERSONA = `You grade the output of a cheaper AI model against a reference output from a stronger model, for a personal therapy-notes app. The app keeps Gabe's weekly therapy sessions with his therapist, David, within reach: it summarizes each session, maps it onto long-running "problems", writes a short "focus" card, writes journal insights and answers chat questions. The source material (Gabe's profile, every therapy note, recent journal entries) is given below and is the ground truth. The reference is NOT ground truth: if the candidate is more faithful to the source than the reference, score it higher.

Score the CANDIDATE on four criteria, each an integer 1 (bad) to 5 (excellent), or null when the criterion does not apply:
- faithfulness: everything stated is supported by the source; no invented advice, quotes, sessions or facts; David's advice is not confused with Gabe's own ideas.
- problem_mapping: ONLY for session items (null otherwise). Given the candidate's own "problems_before" list, did it update the right existing problems by id instead of spawning near-duplicates, and open new problems only for durable themes?
- usefulness: would this help Gabe next week: specific, concrete, the things that matter, nothing important missing.
- tone: warm, direct, plain; Gabe and David by name; no clinical jargon, platitudes, cheerleading or "as an AI".

Give each score a one-line reason that names the concrete difference from the reference when there is one. Reply with ONLY this JSON object, no prose before or after:
{"faithfulness":{"score":4,"reason":"..."},"problem_mapping":{"score":null,"reason":"not a session item"},"usefulness":{"score":4,"reason":"..."},"tone":{"score":5,"reason":"..."}}`;

/** The ground truth block: profile, every therapy note, and the journal entries the pack shows. */
export const sourceMaterial = (seed: Seed): string => {
    const notes = seed.notes.map((n) => `## Session ${n.date}\n\n${n.body}`).join('\n\n');
    const journal = [...seed.journal]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, PACK_JOURNAL_ENTRIES)
        .map((e) => `## Journal ${e.date}\n\n${e.body}`)
        .join('\n\n');
    return `# SOURCE MATERIAL\n\n# Profile\n\n${seed.profile.trim()}\n\n# Therapy notes (oldest first)\n\n${notes}\n\n# Recent journal entries (newest first)\n\n${journal}`;
};

const ITEM_FILE = /^(session-\d+-[\d-]+\.json|focus\.json|insight\.md|chat-\d+\.md)$/;

/** The gradeable files a run wrote, sessions first in order, then focus, insight, chats. */
export const itemFiles = (dir: string): string[] => {
    const rank = (f: string): number => (f.startsWith('session') ? 0 : f.startsWith('focus') ? 1 : f.startsWith('insight') ? 2 : 3);
    return readdirSync(dir)
        .filter((f) => ITEM_FILE.test(f))
        .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true }));
};

/** One output file as the judge reads it. Session JSON drops the notes (they are in the source). */
const readItem = (path: string): string => {
    const text = readFileSync(path, 'utf8');
    if (!path.endsWith('.json')) return text;
    const { notes: _notes, ...rest } = JSON.parse(text) as Record<string, unknown>;
    return JSON.stringify(rest, null, 2);
};

/** Grades every candidate against `reference` and writes `<out_dir>/judge.md`. */
export const runJudge = async (seed: Seed, opts: { out_dir: string; reference: string; candidates: string[]; log: (line: string) => void }): Promise<void> => {
    const ref_dir = join(opts.out_dir, opts.reference);
    if (!existsSync(ref_dir)) throw new Error(`no reference output at ${ref_dir}; run the eval with --models including ${opts.reference} first`);
    const system = svc_claude.systemBlocks([JUDGE_PERSONA, sourceMaterial(seed)]);
    resetAiUsage();
    const results: { model: string; items: JudgedItem[] }[] = [];

    for (const model of opts.candidates) {
        const dir = join(opts.out_dir, model);
        if (!existsSync(dir)) {
            opts.log(`judge: skipping ${model} (no output at ${dir})`);
            continue;
        }
        const items: JudgedItem[] = [];
        for (const file of itemFiles(ref_dir)) {
            const item = file.replace(/\.(json|md)$/, '');
            if (!existsSync(join(dir, file))) {
                items.push({ item, scores: null, raw: `${model} has no ${file}` });
                continue;
            }
            const content = `Item: ${item} (${file.startsWith('session') ? 'session item: grade problem_mapping' : 'not a session item: problem_mapping is null'})\n\n<reference model="${opts.reference}">\n${readItem(join(ref_dir, file))}\n</reference>\n\n<candidate model="${model}">\n${readItem(join(dir, file))}\n</candidate>\n\nGrade the candidate.`;
            try {
                const reply = await svc_claude.completeText({ task: 'focus', model: JUDGE_MODEL, effort: 'high', system, messages: [{ role: 'user', content }] });
                const scores = parseJudgeReply(reply);
                items.push(scores ? { item, scores } : { item, scores: null, raw: reply });
            } catch (e) {
                items.push({ item, scores: null, raw: e instanceof Error ? e.message : String(e) });
            }
            opts.log(`judge: ${model} ${item} done`);
        }
        results.push({ model, items });
    }

    const md = renderJudge({ judge_model: JUDGE_MODEL, reference: opts.reference, results, est_usd: getAiUsage().total_usd, generated_at: new Date().toISOString() });
    writeFileSync(join(opts.out_dir, 'judge.md'), md);
    opts.log(`judge: wrote ${join(opts.out_dir, 'judge.md')}`);
};
