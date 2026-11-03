// AI model routing and cost visibility. Every Claude call names one of these tasks; the backend
// resolves model + effort per task (svc-models.ts) and GET /ai/usage reports what each one cost.

export const AI_TASKS = ['summarize', 'map_problems', 'focus', 'insight', 'chat', 'title'] as const;

export type AiTask = (typeof AI_TASKS)[number];

export type AiEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Totals for one task on one model since the API booted (in-memory; resets on restart). */
export interface AiUsageRow {
    task: AiTask;
    model: string;
    effort: AiEffort;
    // True for the model the task is routed to now; false for a row left by an override.
    is_configured: boolean;
    calls: number;
    input_tokens: number;
    cache_write_tokens: number;
    cache_read_tokens: number;
    output_tokens: number;
    est_usd: number;
}

/** GET /ai/usage */
export interface AiUsage {
    // ISO time the counters started (API boot).
    since: string;
    // False when ANTHROPIC_API_KEY is unset — every AI call will fail until it is.
    configured: boolean;
    rows: AiUsageRow[];
    total_usd: number;
}
