import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { AI_TASKS } from '@therapy-aid/shared';
import { getAiUsage, recordUsage, resetAiUsage, tokenCounts } from '@/services/common/svc-claude-usage';
import { app_env } from '@/services/common/svc-env';

// The in-memory per-task totals behind GET /ai/usage.

const usage = (over: Partial<Anthropic.Usage> = {}) => ({ input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0, ...over }) as Anthropic.Usage;
let log: ReturnType<typeof spyOn>;

beforeEach(() => {
    resetAiUsage();
    log = spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
    log.mockRestore();
    app_env.claude_task_models.chat = '';
});

describe('tokenCounts', () => {
    it('reads null cache fields as 0', () => {
        expect(tokenCounts({ input_tokens: 5, output_tokens: 2, cache_read_input_tokens: null, cache_creation_input_tokens: null } as Anthropic.Usage)).toEqual({ input_tokens: 5, output_tokens: 2, cache_read_tokens: 0, cache_write_tokens: 0 });
    });
});

describe('getAiUsage', () => {
    it('lists every task with its configured route, zero before any call', () => {
        const report = getAiUsage();
        expect(report.rows.map((r) => r.task)).toEqual([...AI_TASKS]);
        expect(report.rows.every((r) => r.calls === 0 && r.is_configured)).toBe(true);
        expect(report.total_usd).toBe(0);
        expect(report.configured).toBe(false);
        expect(Number.isNaN(Date.parse(report.since))).toBe(false);
    });

    it('accumulates calls per task and totals the estimate', () => {
        recordUsage('chat', 'claude-sonnet-5-5', 'medium', usage());
        recordUsage('chat', 'claude-sonnet-5-5', 'medium', usage({ input_tokens: 50 }));
        const chat = getAiUsage().rows.find((r) => r.task === 'chat')!;
        expect(chat).toMatchObject({ calls: 2, input_tokens: 150, cache_read_tokens: 2000, output_tokens: 20 });
        expect(getAiUsage().total_usd).toBeCloseTo(chat.est_usd, 9);
    });

    it('keeps a row for a model the task is no longer routed to', () => {
        recordUsage('chat', 'claude-opus-5-5', 'medium', usage());
        app_env.claude_task_models.chat = 'claude-haiku-5-5';
        const chat_rows = getAiUsage().rows.filter((r) => r.task === 'chat');
        expect(chat_rows.map((r) => [r.model, r.is_configured, r.calls])).toEqual([
            ['claude-haiku-5-5', true, 0],
            ['claude-opus-5-5', false, 1],
        ]);
    });
});
