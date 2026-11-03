// One model's eval run: the app's real prompts, clamps and call shapes, driven against the seed
// data with svc-claude's model/effort override (CallOptions — the eval is its only user). Mirrors
// the pipeline: summarize each note oldest first, map it onto the problems the earlier sessions
// produced, then one focus, one journal insight and three chat questions over the final state.
// A failed step is written down and the run carries on, so one bad reply never voids a model.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TaskRoute } from '../../backend/src/services/common/svc-models';
import * as svc_claude from '../../backend/src/services/common/svc-claude';
import { getAiUsage, resetAiUsage } from '../../backend/src/services/common/svc-claude-usage';
import { buildUserTurn, CHAT_PERSONA } from '../../backend/src/services/chat/prompts';
import { CHAT_TOOLS } from '../../backend/src/services/chat/tools';
import { formatDay, truncateWords } from '../../backend/src/services/context/format';
import { clampFocus } from '../../backend/src/services/focus/focus';
import { buildFocusRequest, FOCUS_PERSONA, FocusSchema } from '../../backend/src/services/focus/prompts';
import { buildInsightMessage, INSIGHT_PERSONA, InsightSchema } from '../../backend/src/services/journal/prompts';
import { isStale, lastTouchedMs } from '../../backend/src/services/problems/staleness';
import { journalSearchDocument } from '../../backend/src/services/search/search';
import { clampExtraction } from '../../backend/src/services/sessions/map-problems';
import { buildMapMessage, MAP_PROBLEMS_SYSTEM, ProblemExtractionSchema } from '../../backend/src/services/sessions/prompts-map';
import { buildSummarizeMessage, SUMMARIZE_SYSTEM, SummarySchema } from '../../backend/src/services/sessions/prompts';
import { clampSummary } from '../../backend/src/services/sessions/summarize';
import { applyExtraction } from './eval-apply';
import { indexWorld, runEvalTool, searchDocuments } from './eval-tools';
import { contextPack, createWorld, newestJournal, problemMappingContext, problemsByStatus, readySessions, setSummary, summarizationContext, type Seed, type World } from './eval-world';

export const INSIGHT_ENTRY_DATE = '2026-10-13';
export const CHAT_QUESTIONS = ['What has David said about my racing mind?', 'How am I doing with Nicole over time?', 'What should I do tonight if I feel a panic coming on?'];
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RunOptions {
    model: string;
    effort?: TaskRoute['effort'];
    /** ISO instant the run pretends is "now" (focus staleness, "Today is …"). */
    today: string;
    out_dir: string;
    log: (line: string) => void;
}

const errorText = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/** Runs `step`; on a throw logs it and returns { error } so the caller writes it down and moves on. */
const attempt = async <T>(opts: RunOptions, label: string, step: () => Promise<T>): Promise<T | { error: string }> => {
    try {
        return await step();
    } catch (e) {
        opts.log(`  ${label}: FAILED ${errorText(e)}`);
        return { error: errorText(e) };
    }
};

const runSessions = async (world: World, opts: RunOptions, write: (name: string, body: unknown) => void): Promise<void> => {
    const route = { model: opts.model, effort: opts.effort };
    for (const [i, session] of world.sessions.entries()) {
        const date = session.occurred_at.slice(0, 10);
        const record = await attempt(opts, `session ${i + 1}`, async () => {
            const context = summarizationContext(world, session);
            const raw = await svc_claude.completeStructured({
                task: 'summarize',
                ...route,
                system: svc_claude.systemBlocks([SUMMARIZE_SYSTEM]),
                messages: [{ role: 'user', content: buildSummarizeMessage({ occurred_at: session.occurred_at, kind: 'notes', text: session.notes, title_hint: null, context }) }],
                schema: SummarySchema,
            });
            const summary = clampSummary(raw, null);
            setSummary(world, session.id, summary);
            const problems_before = problemMappingContext(world);
            const extraction = clampExtraction(
                await svc_claude.completeStructured({
                    task: 'map_problems',
                    ...route,
                    system: svc_claude.systemBlocks([MAP_PROBLEMS_SYSTEM]),
                    messages: [{ role: 'user', content: buildMapMessage({ occurred_at: session.occurred_at, summary, problems_context: problems_before }) }],
                    schema: ProblemExtractionSchema,
                }),
            );
            const applied = applyExtraction(world, session, extraction);
            opts.log(`  session ${i + 1} (${date}): "${summary.title}" updated=${applied.updated} created=${applied.created} skipped=${applied.skipped}`);
            return { summary, problems_before, extraction, applied };
        });
        write(`session-${i + 1}-${date}.json`, { session_id: session.id, date, notes: session.notes, ...record });
    }
    write('problems.json', { problems: world.problems, updates: world.updates });
};

const runFocus = async (world: World, opts: RunOptions, write: (name: string, body: unknown) => void): Promise<void> => {
    const now = Date.parse(opts.today);
    const latest = readySessions(world, { limit: 1 })[0];
    const pack = contextPack(world);
    write('context-pack.md', pack);
    const result = await attempt(opts, 'focus', async () => {
        const request = buildFocusRequest({
            today: formatDay(opts.today),
            triggered_by: latest ? { id: latest.id, title: latest.title, day: formatDay(latest.occurred_at) } : null,
            stale_problems: world.problems.filter((p) => isStale(p, now)).map((p) => ({ id: p.id, title: p.title, days: Math.floor((now - lastTouchedMs(p)) / DAY_MS) })),
        });
        const reply = await svc_claude.completeStructured({ task: 'focus', model: opts.model, effort: opts.effort, system: svc_claude.systemBlocks([FOCUS_PERSONA, pack]), messages: [{ role: 'user', content: request }], schema: FocusSchema });
        const focus = clampFocus(reply, new Set(problemsByStatus(world, ['active']).map((p) => p.id)));
        world.focus = { id: 1, session_id: latest?.id ?? null, content_json: JSON.stringify(focus), created_at: opts.today };
        opts.log(`  focus: ${focus.headline}`);
        return focus;
    });
    write('focus.json', result);
};

const runInsight = async (world: World, opts: RunOptions, write: (name: string, body: unknown) => void): Promise<void> => {
    const entry = world.journal.find((e) => e.occurred_at.startsWith(INSIGHT_ENTRY_DATE)) ?? newestJournal(world, 1)[0];
    if (!entry) return;
    const others = newestJournal(world, 4)
        .filter((row) => row.id !== entry.id)
        .slice(0, 3)
        .map((row) => `- ${formatDay(row.occurred_at)} [entry #${row.id}]: ${journalSearchDocument(row).title}`);
    const result = await attempt(opts, 'insight', async () => {
        const { body } = await svc_claude.completeStructured({
            task: 'insight',
            model: opts.model,
            effort: opts.effort,
            system: svc_claude.systemBlocks([INSIGHT_PERSONA, contextPack(world)]),
            messages: [{ role: 'user', content: buildInsightMessage({ today: formatDay(opts.today), entry_id: entry.id, entry_day: formatDay(entry.occurred_at), draft: entry.body, others }) }],
            schema: InsightSchema,
        });
        return truncateWords(body, 350);
    });
    const text = typeof result === 'string' ? result : `**FAILED:** ${result.error}`;
    write('insight.md', `# Insight on the ${INSIGHT_ENTRY_DATE} entry [entry #${entry.id}]\n\nModel: ${opts.model}\n\n${text}\n`);
};

const runChat = async (world: World, opts: RunOptions, write: (name: string, body: unknown) => void): Promise<void> => {
    indexWorld(world);
    const pack = contextPack(world);
    for (const [i, question] of CHAT_QUESTIONS.entries()) {
        const tools_used: string[] = [];
        const run_tool = runEvalTool(world);
        const result = await attempt(opts, `chat ${i + 1}`, () =>
            svc_claude.completeWithTools({
                task: 'chat',
                model: opts.model,
                effort: opts.effort,
                system: svc_claude.systemBlocks([CHAT_PERSONA, pack]),
                messages: [{ role: 'user', content: buildUserTurn(question, searchDocuments(question, { limit: 5 }), formatDay(opts.today)) }],
                tools: CHAT_TOOLS,
                run_tool: (name, input) => {
                    tools_used.push(`${name} ${JSON.stringify(input)}`);
                    return run_tool(name, input);
                },
            }),
        );
        const answer = typeof result === 'string' ? result : `**FAILED:** ${result.error}`;
        const tools = tools_used.length ? tools_used.map((t) => `- \`${t}\``).join('\n') : '(none)';
        write(`chat-${i + 1}.md`, `# Q: ${question}\n\nModel: ${opts.model}\n\nTools used:\n${tools}\n\n## Answer\n\n${answer}\n`);
    }
};

/** Runs every step for one model into `<out_dir>/<model>/`, ending with that model's usage.json. */
export const runModel = async (seed: Seed, opts: RunOptions): Promise<void> => {
    const dir = join(opts.out_dir, opts.model);
    mkdirSync(dir, { recursive: true });
    const write = (name: string, body: unknown): void => writeFileSync(join(dir, name), typeof body === 'string' ? body : `${JSON.stringify(body, null, 2)}\n`);
    resetAiUsage();
    opts.log(`${opts.model}${opts.effort ? ` (effort ${opts.effort})` : ''}`);
    const world = createWorld(seed);
    await runSessions(world, opts, write);
    await runFocus(world, opts, write);
    await runInsight(world, opts, write);
    await runChat(world, opts, write);
    write('usage.json', { model: opts.model, rows: getAiUsage().rows.filter((r) => r.model === opts.model && r.calls > 0) });
};
