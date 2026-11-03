import { describe, expect, it } from 'bun:test';
import { average, parseJudgeReply, renderCosts, renderJudge, type JudgedItem, type UsageRow } from '../../../scripts/lib/eval-report';

// The eval's reports: costs.md from usage rows, and the judge's JSON reply → judge.md.

const row = (task: UsageRow['task'], model: string, est_usd: number): UsageRow => ({ task, model, effort: 'high', is_configured: false, calls: 2, input_tokens: 1200, cache_write_tokens: 0, cache_read_tokens: 300, output_tokens: 400, est_usd });

const GOOD = '{"faithfulness":{"score":4,"reason":"close"},"problem_mapping":{"score":null,"reason":"n/a"},"usefulness":{"score":3,"reason":"thin"},"tone":{"score":5,"reason":"warm"}}';

describe('renderCosts', () => {
    it('lists every task row and totals each model against the dearest', () => {
        const md = renderCosts(
            [
                { model: 'claude-opus-5-5', rows: [row('summarize', 'claude-opus-5-5', 0.3), row('focus', 'claude-opus-5-5', 0.1)] },
                { model: 'claude-haiku-5-5', rows: [row('summarize', 'claude-haiku-5-5', 0.02)] },
            ],
            '2026-11-03T00:00:00.000Z',
        );
        expect(md).toContain('| claude-opus-5-5 | summarize | high | 2 | 1,200 | 0 | 300 | 400 | $0.3000 |');
        expect(md).toContain('| claude-opus-5-5 | 4 | $0.4000 | 100% |');
        expect(md).toContain('| claude-haiku-5-5 | 2 | $0.0200 | 5% |');
    });
});

describe('parseJudgeReply', () => {
    it('reads a bare object or one inside a code fence', () => {
        expect(parseJudgeReply(GOOD)?.faithfulness).toEqual({ score: 4, reason: 'close' });
        expect(parseJudgeReply('```json\n' + GOOD + '\n```')?.problem_mapping.score).toBeNull();
    });

    it('rejects out-of-range scores, missing criteria and non-JSON', () => {
        expect(parseJudgeReply(GOOD.replace('"score":4', '"score":7'))).toBeNull();
        expect(parseJudgeReply('{"faithfulness":{"score":4,"reason":"x"}}')).toBeNull();
        expect(parseJudgeReply('I think it is fine.')).toBeNull();
    });
});

describe('renderJudge', () => {
    it('averages only the scores that apply and keeps unusable replies visible', () => {
        const items: JudgedItem[] = [
            { item: 'session-1-2026-08-06', scores: parseJudgeReply(GOOD.replace('"score":null', '"score":2')) },
            { item: 'focus', scores: parseJudgeReply(GOOD) },
            { item: 'chat-1', scores: null, raw: 'not json' },
        ];
        expect(average(items, 'problem_mapping')).toBe(2);
        expect(average(items, 'usefulness')).toBe(3);
        const md = renderJudge({ judge_model: 'claude-opus-5-5', reference: 'claude-opus-5-5', results: [{ model: 'claude-haiku-5-5', items }], est_usd: 0.5, generated_at: 'now' });
        expect(md).toContain('| claude-haiku-5-5 | 4 | 2 | 3 | 5 |');
        expect(md).toContain('| chat-1 | - | - | - | - |');
        expect(md).toContain('**chat-1**: unusable judge reply: not json');
    });
});
