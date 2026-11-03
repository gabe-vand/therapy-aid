import type { AiUsage, AiUsageRow } from '@therapy-aid/shared';

/* An AiUsage payload in the shape GET /ai/usage serves, for the hook and Settings tests. */

export const usage_row = (over: Partial<AiUsageRow> = {}): AiUsageRow => ({
    task: 'chat',
    model: 'claude-sonnet-5-5',
    effort: 'medium',
    is_configured: true,
    calls: 0,
    input_tokens: 0,
    cache_write_tokens: 0,
    cache_read_tokens: 0,
    output_tokens: 0,
    est_usd: 0,
    ...over,
});

export const usage = (over: Partial<AiUsage> = {}): AiUsage => ({
    since: '2026-10-01T12:00:00.000Z',
    configured: true,
    total_usd: 0.0425,
    rows: [
        usage_row({ task: 'summarize', effort: 'high', calls: 2, input_tokens: 12000, cache_write_tokens: 3000, cache_read_tokens: 0, output_tokens: 1800, est_usd: 0.0338 }),
        usage_row({ task: 'chat', calls: 3, input_tokens: 900, cache_read_tokens: 29870, output_tokens: 344, est_usd: 0.0087 }),
        usage_row({ task: 'title', model: 'claude-haiku-5-5', effort: 'low' }),
    ],
    ...over,
});
