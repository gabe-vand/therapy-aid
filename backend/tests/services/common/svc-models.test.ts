import { afterEach, describe, expect, it } from 'bun:test';
import { AI_TASKS } from '@therapy-aid/shared';
import { app_env } from '@/services/common/svc-env';
import { MODEL_IDS, PRICES, TASK_MODELS, describeRouting, estimateCost, resolveTask } from '@/services/common/svc-models';

// Routing precedence and the cost arithmetic the usage log and GET /ai/usage report.

const zero = { input_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0, output_tokens: 0 };

afterEach(() => {
    app_env.claude_model = '';
    for (const task of AI_TASKS) {
        app_env.claude_task_models[task] = '';
        app_env.claude_task_efforts[task] = '';
    }
});

describe('resolveTask', () => {
    it('uses the task table by default', () => {
        for (const task of AI_TASKS) expect(resolveTask(task)).toEqual(TASK_MODELS[task]);
        expect(resolveTask('title')).toEqual({ model: MODEL_IDS.haiku, effort: 'low' });
        expect(resolveTask('focus').model).toBe(MODEL_IDS.opus);
    });

    it('CLAUDE_MODEL overrides every task; CLAUDE_MODEL_<TASK> beats it', () => {
        app_env.claude_model = 'claude-opus-5-5';
        app_env.claude_task_models.summarize = 'claude-haiku-5-5';
        expect(resolveTask('chat').model).toBe('claude-opus-5-5');
        expect(resolveTask('summarize').model).toBe('claude-haiku-5-5');
    });

    it('CLAUDE_EFFORT_<TASK> overrides effort; an invalid value falls back and is reported', () => {
        app_env.claude_task_efforts.chat = 'low';
        app_env.claude_task_efforts.focus = 'extreme';
        expect(resolveTask('chat').effort).toBe('low');
        expect(resolveTask('focus').effort).toBe('high');
        const lines = describeRouting();
        expect(lines[0]).toContain('chat=claude-sonnet-5-5/low');
        expect(lines.some((l) => l.includes('CLAUDE_EFFORT_FOCUS=extreme'))).toBe(true);
    });
});

describe('estimateCost', () => {
    it('prices each token kind at its own rate', () => {
        // Sonnet: 1M in at $2, 1M cache read at $0.20, 1M cache write at $2.50, 1M out at $10.
        expect(estimateCost(MODEL_IDS.sonnet, { input_tokens: 1e6, cache_read_tokens: 1e6, cache_write_tokens: 1e6, output_tokens: 1e6 })).toBeCloseTo(14.7, 6);
        expect(estimateCost(MODEL_IDS.opus, { ...zero, input_tokens: 1e6, output_tokens: 1e6 })).toBeCloseTo(24, 6);
        expect(estimateCost(MODEL_IDS.haiku, { ...zero, input_tokens: 100_000, output_tokens: 100_000 })).toBeCloseTo(0.06, 6);
    });

    it("applies Haiku's long-context tier above 100K prompt tokens", () => {
        expect(estimateCost(MODEL_IDS.haiku, { ...zero, input_tokens: 100_000 })).toBeCloseTo(0.01, 6);
        expect(estimateCost(MODEL_IDS.haiku, { ...zero, input_tokens: 100_001 })).toBeCloseTo(0.0500005, 6);
    });

    it('caching is what makes the big prefix cheap: a cache read is 5-10% of an uncached token', () => {
        const uncached = estimateCost(MODEL_IDS.sonnet, { ...zero, input_tokens: 30_000 });
        const cached = estimateCost(MODEL_IDS.sonnet, { ...zero, cache_read_tokens: 30_000 });
        expect(cached / uncached).toBeCloseTo(0.1, 6);
    });

    it('prices an unknown model as Opus (never under-reports)', () => {
        expect(estimateCost('claude-future-9', { ...zero, output_tokens: 1e6 })).toBe(PRICES[MODEL_IDS.opus]!.output);
    });
});
