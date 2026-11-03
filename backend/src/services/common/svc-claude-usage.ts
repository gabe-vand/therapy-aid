// What the AI costs, per task. Every Claude call ends here: one log line (so `docker compose logs
// api | grep '\[ai\]'` is a cost report) and in-memory totals per task+model, served at
// GET /ai/usage for the Settings page. In-memory on purpose — the log is the durable record.
import type Anthropic from '@anthropic-ai/sdk';
import { AI_TASKS, type AiEffort, type AiTask, type AiUsage, type AiUsageRow } from '@therapy-aid/shared';
import { isAiConfigured } from './svc-claude-transport';
import { estimateCost, resolveTask, type TokenCounts } from './svc-models';

interface Totals extends TokenCounts {
    task: AiTask;
    model: string;
    effort: AiEffort;
    calls: number;
    est_usd: number;
}

const totals = new Map<string, Totals>();
let since = new Date().toISOString();

/** SDK usage → our counts (the SDK reports cache fields as nullable). */
export const tokenCounts = (usage: Anthropic.Usage): TokenCounts => ({
    input_tokens: usage.input_tokens ?? 0,
    cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_tokens: usage.cache_read_input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
});

/** Logs one call and adds it to the task's totals. Returns the estimated USD of the call. */
export const recordUsage = (task: AiTask, model: string, effort: AiEffort, usage: Anthropic.Usage): number => {
    const counts = tokenCounts(usage);
    const usd = estimateCost(model, counts);
    console.log(
        `[ai] task=${task} model=${model} effort=${effort} in=${counts.input_tokens} cached=${counts.cache_read_tokens} write=${counts.cache_write_tokens} out=${counts.output_tokens} est=$${usd.toFixed(4)}`,
    );

    const key = `${task}|${model}`;
    const row = totals.get(key) ?? { task, model, effort, calls: 0, input_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0, output_tokens: 0, est_usd: 0 };
    row.effort = effort;
    row.calls += 1;
    row.input_tokens += counts.input_tokens;
    row.cache_write_tokens += counts.cache_write_tokens;
    row.cache_read_tokens += counts.cache_read_tokens;
    row.output_tokens += counts.output_tokens;
    row.est_usd = Math.round((row.est_usd + usd) * 1e6) / 1e6;
    totals.set(key, row);
    return usd;
};

/** Every task's configured route (zero rows included, so Settings shows the routing table),
    plus any rows a model override left behind, in AI_TASKS order. */
export const getAiUsage = (): AiUsage => {
    const rows: AiUsageRow[] = AI_TASKS.flatMap((task) => {
        const route = resolveTask(task);
        const configured = totals.get(`${task}|${route.model}`);
        const head: AiUsageRow = {
            task,
            model: route.model,
            effort: route.effort,
            is_configured: true,
            calls: configured?.calls ?? 0,
            input_tokens: configured?.input_tokens ?? 0,
            cache_write_tokens: configured?.cache_write_tokens ?? 0,
            cache_read_tokens: configured?.cache_read_tokens ?? 0,
            output_tokens: configured?.output_tokens ?? 0,
            est_usd: configured?.est_usd ?? 0,
        };
        const others = [...totals.values()]
            .filter((row) => row.task === task && row.model !== route.model)
            .sort((a, b) => a.model.localeCompare(b.model))
            .map((row): AiUsageRow => ({ ...row, is_configured: false }));
        return [head, ...others];
    });
    const total_usd = Math.round(rows.reduce((sum, row) => sum + row.est_usd, 0) * 1e6) / 1e6;
    return { since, configured: isAiConfigured(), rows, total_usd };
};

/** Clears the counters (tests; also exposed for a future "reset" button). */
export const resetAiUsage = (): void => {
    totals.clear();
    since = new Date().toISOString();
};
