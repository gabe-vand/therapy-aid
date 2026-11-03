// Every Claude call the app makes goes through these three functions. Each names its task;
// svc-models resolves model + effort (always sent explicitly as output_config.effort — never
// thinking/temperature/budget_tokens: adaptive thinking is the default on every model we use).
// Every response is checked for a refusal, logged with its cost (svc-claude-usage), and turned
// into a plain value or an AiError whose message is safe to show.
//
// Feature tests stub these with spyOn on a namespace import — `import * as svc_claude from
// '@/services/common/svc-claude'; spyOn(svc_claude, 'completeStructured').mockResolvedValue(…)`.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AiEffort, AiTask } from '@therapy-aid/shared';
import type { z } from 'zod';
import { AiError, getClaudeTransport } from './svc-claude-transport';
import { recordUsage } from './svc-claude-usage';
import { resolveTask, type TaskRoute } from './svc-models';

export { AiError, AiNotConfiguredError } from './svc-claude-transport';

/** The model declined (stop_reason 'refusal'). */
export class AiRefusalError extends AiError {
    constructor() {
        super('The AI model declined to answer this request.');
    }
}

/** The reply was unusable: cut off, unparseable, or still calling tools at the step limit. */
export class AiOutputError extends AiError {}

export type SystemBlock = Anthropic.TextBlockParam;
export type ConversationMessage = Anthropic.MessageParam;

const MAX_TOKENS = 16000;

interface CallOptions {
    task: AiTask;
    system: SystemBlock[];
    messages: ConversationMessage[];
    max_tokens?: number;
    // Eval harness only (scripts/eval-models.ts) — production call sites name just the task.
    model?: string;
    effort?: AiEffort;
}

/** System prompt as text blocks for prompt caching: each `stable` block (persona, context pack —
    byte-identical between calls) carries cache_control; the optional `volatile` block comes last,
    unmarked. At most 3 stable blocks (the API allows 4 breakpoints; completeWithTools spends the
    4th). Prefer putting volatile content (today's date, the draft, the question) in the user
    message instead — it is the cheapest place for it. */
export const systemBlocks = (stable: string[], volatile?: string): SystemBlock[] => {
    if (stable.length > 3) throw new Error('systemBlocks: at most 3 stable (cached) blocks');
    const blocks: SystemBlock[] = stable.filter((text) => text.length > 0).map((text) => ({ type: 'text', text, cache_control: { type: 'ephemeral' } }));
    if (volatile) blocks.push({ type: 'text', text: volatile });
    return blocks;
};

const route = (opts: CallOptions): TaskRoute => {
    const resolved = resolveTask(opts.task);
    return { model: opts.model ?? resolved.model, effort: opts.effort ?? resolved.effort };
};

/** Logs usage, then rejects refusals and truncation — the checks every reply goes through. */
const accept = (opts: CallOptions, r: TaskRoute, response: Anthropic.Message): void => {
    recordUsage(opts.task, r.model, r.effort, response.usage);
    if (response.stop_reason === 'refusal') {
        console.warn(`[ai] task=${opts.task} refused`, response.stop_details ?? '');
        throw new AiRefusalError();
    }
    if (response.stop_reason === 'max_tokens' || response.stop_reason === 'model_context_window_exceeded') {
        throw new AiOutputError('The AI reply was cut off before it finished. Try again.');
    }
};

/** The concatenated text blocks of a reply. */
export const replyText = (response: Anthropic.Message): string =>
    response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();

/** One structured call: the reply is validated against `schema` (zod) and returned typed.
    Keep hard limits (string max, array max > 1) OUT of the schema — they are checked only after
    the reply arrives and fail the whole call; describe them in the prompt and clamp afterwards. */
export const completeStructured = async <T>(opts: CallOptions & { schema: z.ZodType<T> }): Promise<T> => {
    const r = route(opts);
    let response;
    try {
        response = await getClaudeTransport().parse({
            model: r.model,
            max_tokens: opts.max_tokens ?? MAX_TOKENS,
            system: opts.system,
            messages: opts.messages,
            output_config: { effort: r.effort, format: zodOutputFormat(opts.schema) },
        });
    } catch (e) {
        // The SDK throws a plain AnthropicError (not an APIError) when the reply fails the schema.
        if (e instanceof Anthropic.AnthropicError && !(e instanceof Anthropic.APIError)) {
            // Only the error's class: its message can quote the model's output (session content).
            console.error(`[ai] task=${opts.task} structured output rejected (${e.constructor.name})`);
            throw new AiOutputError('The AI reply did not have the expected structure (it may have declined or been cut off). Try again.');
        }
        throw e;
    }
    accept(opts, r, response);
    if (response.parsed_output === null || response.parsed_output === undefined) {
        throw new AiOutputError('The AI reply did not have the expected structure. Try again.');
    }
    return response.parsed_output as T;
};

/** One plain-text call (markdown allowed). */
export const completeText = async (opts: CallOptions): Promise<string> => {
    const r = route(opts);
    const response = await getClaudeTransport().create({
        model: r.model,
        max_tokens: opts.max_tokens ?? MAX_TOKENS,
        system: opts.system,
        messages: opts.messages,
        output_config: { effort: r.effort },
    });
    accept(opts, r, response);
    return replyText(response);
};

export interface ToolOptions extends CallOptions {
    tools: Anthropic.Tool[];
    // Runs one tool call and returns its result text. Validate `input` yourself (zod safeParse);
    // a throw becomes an is_error tool_result carrying the error message, never a crash.
    run_tool: (name: string, input: unknown) => Promise<string>;
    max_iterations?: number;
}

/** The manual agentic loop (SDK tool-use doc): call, run every tool_use of the turn, return ALL
    the tool_results in ONE user message, repeat until end_turn. Top-level cache_control caches
    the growing tail so each step re-reads the previous one. Throws after max_iterations. */
export const completeWithTools = async (opts: ToolOptions): Promise<string> => {
    const r = route(opts);
    const max_iterations = opts.max_iterations ?? 6;
    const messages = [...opts.messages];

    for (let step = 0; step < max_iterations; step++) {
        const response = await getClaudeTransport().create({
            model: r.model,
            max_tokens: opts.max_tokens ?? MAX_TOKENS,
            system: opts.system,
            messages,
            tools: opts.tools,
            output_config: { effort: r.effort },
            cache_control: { type: 'ephemeral' },
        });
        accept(opts, r, response);

        if (response.stop_reason === 'pause_turn') {
            messages.push({ role: 'assistant', content: response.content });
            continue;
        }
        const uses = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
        if (response.stop_reason !== 'tool_use' || uses.length === 0) return replyText(response);

        messages.push({ role: 'assistant', content: response.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const use of uses) {
            try {
                results.push({ type: 'tool_result', tool_use_id: use.id, content: await opts.run_tool(use.name, use.input) });
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                console.warn(`[ai] task=${opts.task} tool ${use.name} failed: ${message}`);
                results.push({ type: 'tool_result', tool_use_id: use.id, content: message, is_error: true });
            }
        }
        messages.push({ role: 'user', content: results });
    }
    throw new AiOutputError(`The AI was still looking things up after ${max_iterations} steps. Try a more specific question.`);
};
