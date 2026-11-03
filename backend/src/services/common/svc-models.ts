// Model routing and cost estimation. No call site ever names a model: it names its task, and this
// table resolves the model + effort — so moving a task to a cheaper model (after the eval in
// scripts/eval-models.ts says quality holds) is a one-line change here or one env var on the Pi.
// Precedence: CLAUDE_MODEL_<TASK> > CLAUDE_MODEL (global) > TASK_MODELS default.
import { AI_TASKS, type AiEffort, type AiTask } from '@therapy-aid/shared';
import { app_env } from './svc-env';

export const MODEL_IDS = {
    opus: 'claude-opus-5-5',
    sonnet: 'claude-sonnet-5-5',
    haiku: 'claude-haiku-5-5',
} as const;

export interface TaskRoute {
    model: string;
    effort: AiEffort;
}

/** The default route per task. Narrow, evidence-fed tasks run on cheaper models; judgment over
    the whole picture (focus) stays on Opus. Haiku only gets mechanical work (thread titles). */
export const TASK_MODELS: Record<AiTask, TaskRoute> = {
    summarize: { model: MODEL_IDS.sonnet, effort: 'high' },
    map_problems: { model: MODEL_IDS.sonnet, effort: 'high' },
    focus: { model: MODEL_IDS.opus, effort: 'high' },
    insight: { model: MODEL_IDS.sonnet, effort: 'high' },
    chat: { model: MODEL_IDS.sonnet, effort: 'medium' },
    title: { model: MODEL_IDS.haiku, effort: 'low' },
};

export const EFFORTS: readonly AiEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

const isEffort = (value: string): value is AiEffort => (EFFORTS as readonly string[]).includes(value);

/** The model + effort a task runs on right now, env overrides applied. An unrecognised
    CLAUDE_EFFORT_<TASK> value falls back to the table default (logged by describeRouting). */
export const resolveTask = (task: AiTask): TaskRoute => {
    const model = app_env.claude_task_models[task] || app_env.claude_model || TASK_MODELS[task].model;
    const raw_effort = app_env.claude_task_efforts[task];
    return { model, effort: isEffort(raw_effort) ? raw_effort : TASK_MODELS[task].effort };
};

/** USD per million tokens. cache_write is the 5-minute TTL rate (1.25x input). */
export interface ModelPrice {
    input: number;
    output: number;
    cache_read: number;
    cache_write: number;
}

interface PriceEntry extends ModelPrice {
    // Haiku 5.5 bills prompts over 100K tokens at a higher tier.
    long_context?: { above_tokens: number; price: ModelPrice };
}

const tier = (input: number, output: number, cache_read: number): ModelPrice => ({ input, output, cache_read, cache_write: input * 1.25 });

/** Published list prices (shared/models.md, Nov 2026). Haiku's cache-read rate is not published in
    our reference; 0.1x input is assumed. Unknown models are estimated at Opus prices (the
    conservative choice: an unknown model never looks cheaper than it is). */
export const PRICES: Record<string, PriceEntry> = {
    [MODEL_IDS.opus]: tier(4, 20, 0.2),
    [MODEL_IDS.sonnet]: tier(2, 10, 0.2),
    [MODEL_IDS.haiku]: { ...tier(0.1, 0.5, 0.01), long_context: { above_tokens: 100_000, price: tier(0.5, 2.5, 0.05) } },
};

export interface TokenCounts {
    input_tokens: number;
    cache_write_tokens: number;
    cache_read_tokens: number;
    output_tokens: number;
}

/** Estimated USD for one call's usage on `model`. An estimate, not a bill — it ignores batch
    discounts and 1-hour cache writes, neither of which this app uses. */
export const estimateCost = (model: string, usage: TokenCounts): number => {
    const entry = PRICES[model] ?? PRICES[MODEL_IDS.opus]!;
    const prompt_tokens = usage.input_tokens + usage.cache_write_tokens + usage.cache_read_tokens;
    const price = entry.long_context && prompt_tokens > entry.long_context.above_tokens ? entry.long_context.price : entry;
    const usd = (usage.input_tokens * price.input + usage.cache_write_tokens * price.cache_write + usage.cache_read_tokens * price.cache_read + usage.output_tokens * price.output) / 1_000_000;
    return Math.round(usd * 1e6) / 1e6;
};

/** One boot log line per task ("summarize=claude-sonnet-5-5/high …"), plus a warning for any
    effort override that was ignored, so the Pi's logs show what everything runs on. */
export const describeRouting = (): string[] => {
    const routes = AI_TASKS.map((task) => {
        const { model, effort } = resolveTask(task);
        return `${task}=${model}/${effort}`;
    });
    const ignored = AI_TASKS.filter((task) => app_env.claude_task_efforts[task] && !isEffort(app_env.claude_task_efforts[task])).map(
        (task) => `[ai] ignoring CLAUDE_EFFORT_${task.toUpperCase()}=${app_env.claude_task_efforts[task]} (expected one of ${EFFORTS.join('|')})`,
    );
    return [`[ai] routing ${routes.join(' ')}`, ...ignored];
};
