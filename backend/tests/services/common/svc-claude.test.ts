import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AiNotConfiguredError, AiOutputError, AiRefusalError, completeStructured, completeText, completeWithTools, systemBlocks } from '@/services/common/svc-claude';
import { getAiUsage, resetAiUsage } from '@/services/common/svc-claude-usage';
import { installFakeClaude, message, text, toolUse, type FakeTransport } from '../../helpers/hlp-claude';

// svc-claude against a fake transport: the request shapes we send, every failure path, the
// tool loop, and the usage it records. No network, no mock.module.

const Summary = z.object({ title: z.string(), points: z.array(z.string()) });
const base = { task: 'summarize' as const, system: systemBlocks(['persona']), messages: [{ role: 'user' as const, content: 'hi' }] };
let fake: FakeTransport | null = null;

beforeEach(() => resetAiUsage());
afterEach(() => {
    fake?.restore();
    fake = null;
});

describe('systemBlocks', () => {
    it('marks every stable block for caching and leaves the volatile block unmarked, last', () => {
        expect(systemBlocks(['persona', 'pack'], 'today is Monday')).toEqual([
            { type: 'text', text: 'persona', cache_control: { type: 'ephemeral' } },
            { type: 'text', text: 'pack', cache_control: { type: 'ephemeral' } },
            { type: 'text', text: 'today is Monday' },
        ]);
    });

    it('rejects more than 3 cached blocks (the API allows 4 breakpoints; the tool loop uses one)', () => {
        expect(() => systemBlocks(['a', 'b', 'c', 'd'])).toThrow();
    });
});

describe('not configured', () => {
    it('throws AiNotConfiguredError naming ANTHROPIC_API_KEY when no key and no fake', async () => {
        const call = completeText(base);
        await expect(call).rejects.toBeInstanceOf(AiNotConfiguredError);
        await expect(call).rejects.toThrow(/ANTHROPIC_API_KEY/);
    });
});

describe('completeStructured', () => {
    it('sends the routed model, explicit effort, the zod format — and nothing about thinking or temperature', async () => {
        fake = installFakeClaude([message([text('{"title":"T","points":["a"]}')])]);
        expect(await completeStructured({ ...base, schema: Summary })).toEqual({ title: 'T', points: ['a'] });

        const sent = fake.requests[0]!;
        expect(sent.model).toBe('claude-sonnet-5-5');
        expect(sent.max_tokens).toBe(16000);
        expect(sent.output_config?.effort).toBe('high');
        expect(sent.output_config?.format?.type).toBe('json_schema');
        expect(sent).not.toHaveProperty('thinking');
        expect(sent).not.toHaveProperty('temperature');
        expect(sent.system).toEqual(base.system);
    });

    it('honours the eval-only model / effort overrides', async () => {
        fake = installFakeClaude([message([text('{"title":"T","points":[]}')])]);
        await completeStructured({ ...base, schema: Summary, model: 'claude-haiku-5-5', effort: 'low' });
        expect(fake.requests[0]!.model).toBe('claude-haiku-5-5');
        expect(fake.requests[0]!.output_config?.effort).toBe('low');
    });

    it('throws AiRefusalError on stop_reason refusal', async () => {
        fake = installFakeClaude([message([], 'refusal')]);
        const call = completeStructured({ ...base, schema: Summary });
        await expect(call).rejects.toBeInstanceOf(AiRefusalError);
        await expect(call).rejects.toThrow(/declined/);
    });

    it('throws AiOutputError when parsed_output is null (no text block came back)', async () => {
        fake = installFakeClaude([message([])]);
        await expect(completeStructured({ ...base, schema: Summary })).rejects.toBeInstanceOf(AiOutputError);
    });

    it('turns the SDK schema-mismatch error into AiOutputError', async () => {
        fake = installFakeClaude([message([text('{"title":5}')])]);
        const error = spyOn(console, 'error').mockImplementation(() => {});
        await expect(completeStructured({ ...base, schema: Summary })).rejects.toBeInstanceOf(AiOutputError);
        expect(error).toHaveBeenCalled();
        error.mockRestore();
    });

    it('throws AiOutputError when the reply was cut off', async () => {
        fake = installFakeClaude([message([text('{"title":"T","points":[]}')], 'max_tokens')]);
        await expect(completeStructured({ ...base, schema: Summary })).rejects.toThrow(/cut off/);
    });

    it('lets API errors (rate limits, 5xx) through untouched', async () => {
        const api_error = new Anthropic.APIError(529, undefined, 'overloaded', new Headers());
        fake = installFakeClaude([api_error]);
        await expect(completeStructured({ ...base, schema: Summary })).rejects.toBe(api_error);
    });
});

describe('completeText', () => {
    it('joins the text blocks and records usage under the task', async () => {
        fake = installFakeClaude([message([text('Hello '), text('Gabe')], 'end_turn', { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 5000 })]);
        expect(await completeText({ ...base, task: 'title' })).toBe('Hello Gabe');
        expect(fake.requests[0]!.model).toBe('claude-haiku-5-5');
        expect(fake.requests[0]!.output_config).toEqual({ effort: 'low' });

        const row = getAiUsage().rows.find((r) => r.task === 'title')!;
        expect(row).toMatchObject({ calls: 1, input_tokens: 1000, cache_read_tokens: 5000, output_tokens: 100 });
        expect(row.est_usd).toBeGreaterThan(0);
    });

    it('logs one [ai] line per call with task, model, tokens and cost', async () => {
        const log = spyOn(console, 'log').mockImplementation(() => {});
        fake = installFakeClaude([message([text('ok')], 'end_turn', { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 7 })]);
        await completeText(base);
        expect(log.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith('[ai]'))).toMatch(/^\[ai\] task=summarize model=claude-sonnet-5-5 effort=high in=10 cached=7 write=0 out=5 est=\$\d/);
        log.mockRestore();
    });

    it('throws AiRefusalError on refusal', async () => {
        fake = installFakeClaude([message([text('partial')], 'refusal')]);
        await expect(completeText(base)).rejects.toBeInstanceOf(AiRefusalError);
    });
});

describe('completeWithTools', () => {
    const tools: Anthropic.Tool[] = [{ name: 'search_notes', description: 'search', input_schema: { type: 'object', properties: { query: { type: 'string' } } } }];

    it('runs every tool_use of a turn and returns ALL results in ONE user message', async () => {
        fake = installFakeClaude([message([text('Let me look.'), toolUse('t1', 'search_notes', { query: 'panic' }), toolUse('t2', 'search_notes', { query: 'sleep' })], 'tool_use'), message([text('Here is what David said.')])]);
        const ran: unknown[] = [];
        const answer = await completeWithTools({ ...base, task: 'chat', tools, run_tool: async (name, input) => (ran.push([name, input]), `result for ${(input as { query: string }).query}`) });

        expect(answer).toBe('Here is what David said.');
        expect(ran).toEqual([
            ['search_notes', { query: 'panic' }],
            ['search_notes', { query: 'sleep' }],
        ]);
        const second = fake.requests[1]!;
        expect(second.messages).toHaveLength(3);
        expect(second.messages[1]!.role).toBe('assistant');
        expect(second.messages[2]).toEqual({
            role: 'user',
            content: [
                { type: 'tool_result', tool_use_id: 't1', content: 'result for panic' },
                { type: 'tool_result', tool_use_id: 't2', content: 'result for sleep' },
            ],
        });
        expect(second.tools).toEqual(tools);
        expect(second.cache_control).toEqual({ type: 'ephemeral' });
        expect(second.output_config).toEqual({ effort: 'medium' });
        expect(getAiUsage().rows.find((r) => r.task === 'chat')!.calls).toBe(2);
    });

    it('returns a throwing tool as an is_error result instead of crashing', async () => {
        fake = installFakeClaude([message([toolUse('t1', 'read_session', { session_id: 99 })], 'tool_use'), message([text('That session does not exist.')])]);
        const warn = spyOn(console, 'warn').mockImplementation(() => {});
        const answer = await completeWithTools({ ...base, tools, run_tool: async () => Promise.reject(new Error('No session #99')) });
        warn.mockRestore();

        expect(answer).toBe('That session does not exist.');
        expect(fake.requests[1]!.messages[2]!.content).toEqual([{ type: 'tool_result', tool_use_id: 't1', content: 'No session #99', is_error: true }]);
    });

    it('continues a pause_turn without running tools', async () => {
        fake = installFakeClaude([message([text('thinking…')], 'pause_turn'), message([text('done')])]);
        expect(await completeWithTools({ ...base, tools, run_tool: async () => 'never' })).toBe('done');
        expect(fake.requests[1]!.messages.at(-1)!.role).toBe('assistant');
    });

    it('throws AiOutputError after max_iterations of tool use', async () => {
        const loop = () => message([toolUse('t', 'search_notes', { query: 'x' })], 'tool_use');
        fake = installFakeClaude([loop(), loop()]);
        await expect(completeWithTools({ ...base, tools, run_tool: async () => 'r', max_iterations: 2 })).rejects.toBeInstanceOf(AiOutputError);
    });

    it('stops on a refusal mid-loop', async () => {
        fake = installFakeClaude([message([toolUse('t', 'search_notes', {})], 'tool_use'), message([], 'refusal')]);
        await expect(completeWithTools({ ...base, tools, run_tool: async () => 'r' })).rejects.toBeInstanceOf(AiRefusalError);
    });
});
