// The eval's two reports, as pure functions so they are testable without a model: costs.md (tokens
// and estimated dollars per task per model, from svc-claude's usage totals) and judge.md (Opus's
// 1-5 grades of each cheaper model against Opus's own output). parseJudgeReply turns the judge's
// JSON reply into scores, or null when it is unusable (the raw text is then kept in judge.md).
import type { getAiUsage } from '../../backend/src/services/common/svc-claude-usage';

export type UsageRow = ReturnType<typeof getAiUsage>['rows'][number];
export interface ModelUsage {
    model: string;
    rows: UsageRow[];
}

export const CRITERIA = ['faithfulness', 'problem_mapping', 'usefulness', 'tone'] as const;
export type Criterion = (typeof CRITERIA)[number];
const HEADINGS: Record<Criterion, string> = { faithfulness: 'Faithful', problem_mapping: 'Mapping', usefulness: 'Useful', tone: 'Tone' };

export interface Grade {
    score: number | null;
    reason: string;
}
export type Scores = Record<Criterion, Grade>;
export interface JudgedItem {
    item: string;
    scores: Scores | null;
    raw?: string;
}

const usd = (n: number): string => `$${n.toFixed(4)}`;
const int = (n: number): string => n.toLocaleString('en-US');

/** costs.md: one row per model+task, then a per-model total with its share of the dearest. */
export const renderCosts = (usage: ModelUsage[], generated_at: string): string => {
    const rows = usage.flatMap(({ model, rows }) =>
        rows.map((r) => `| ${model} | ${r.task} | ${r.effort} | ${r.calls} | ${int(r.input_tokens)} | ${int(r.cache_write_tokens)} | ${int(r.cache_read_tokens)} | ${int(r.output_tokens)} | ${usd(r.est_usd)} |`),
    );
    const totals = usage.map(({ model, rows }) => ({ model, calls: rows.reduce((s, r) => s + r.calls, 0), est: rows.reduce((s, r) => s + r.est_usd, 0) }));
    const dearest = Math.max(0, ...totals.map((t) => t.est));
    const total_rows = totals.map((t) => `| ${t.model} | ${t.calls} | ${usd(t.est)} | ${dearest > 0 ? `${Math.round((t.est / dearest) * 100)}%` : '-'} |`);
    return [
        '# Model eval: costs',
        '',
        `Generated ${generated_at}. Estimates from the svc-claude usage log at the list prices in \`svc-models.ts\`, not a bill.`,
        '',
        '## Per task',
        '',
        '| Model | Task | Effort | Calls | Input | Cache write | Cache read | Output | Est. |',
        '|---|---|---|---|---|---|---|---|---|',
        ...rows,
        '',
        '## Per model (one full run: 6 sessions x 2 calls, focus, insight, 3 chats)',
        '',
        '| Model | Calls | Est. | vs dearest |',
        '|---|---|---|---|',
        ...total_rows,
        '',
    ].join('\n');
};

/** The judge's reply → scores. Accepts a bare JSON object or one inside a ``` fence; a score
    must be an integer 1-5 or null (not applicable). Null when anything is off. */
export const parseJudgeReply = (text: string): Scores | null => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    let raw: Record<string, unknown>;
    try {
        raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
        return null;
    }
    const out = {} as Scores;
    for (const c of CRITERIA) {
        const g = raw[c] as { score?: unknown; reason?: unknown } | undefined;
        if (!g || typeof g.reason !== 'string') return null;
        const ok = g.score === null || (typeof g.score === 'number' && Number.isInteger(g.score) && g.score >= 1 && g.score <= 5);
        if (!ok) return null;
        out[c] = { score: g.score as number | null, reason: g.reason.trim() };
    }
    return out;
};

/** Mean of the non-null scores for one criterion, or null when none apply. */
export const average = (items: JudgedItem[], c: Criterion): number | null => {
    const scores = items.map((i) => i.scores?.[c].score).filter((s): s is number => typeof s === 'number');
    return scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;
};

const cell = (n: number | null | undefined): string => (n === null || n === undefined ? '-' : String(n));

/** judge.md: an overview table across models, then each model's items with every reason. */
export const renderJudge = (opts: { judge_model: string; reference: string; results: { model: string; items: JudgedItem[] }[]; est_usd: number; generated_at: string }): string => {
    const head = `| ${CRITERIA.map((c) => HEADINGS[c]).join(' | ')} |`;
    const rule = `|${CRITERIA.map(() => '---|').join('')}`;
    const lines = [
        '# Model eval: judge',
        '',
        `Generated ${opts.generated_at}. Judge: ${opts.judge_model}, grading each model against ${opts.reference} on the source notes. Scores 1-5, "-" = not applicable. The judge is an aid, not the decision: read the raw outputs too. Judging cost about ${usd(opts.est_usd)}.`,
        '',
        '## Averages',
        '',
        `| Model ${head}`,
        `|---${rule}`,
        ...opts.results.map(({ model, items }) => `| ${model} | ${CRITERIA.map((c) => cell(average(items, c))).join(' | ')} |`),
    ];
    for (const { model, items } of opts.results) {
        lines.push('', `## ${model}`, '', `| Item ${head}`, `|---${rule}`);
        lines.push(...items.map((i) => `| ${i.item} | ${CRITERIA.map((c) => cell(i.scores?.[c].score)).join(' | ')} |`));
        lines.push('');
        for (const i of items) {
            if (!i.scores) {
                lines.push(`- **${i.item}**: unusable judge reply: ${(i.raw ?? '').replace(/\s+/g, ' ').slice(0, 300)}`);
                continue;
            }
            const reasons = CRITERIA.map((c) => `${HEADINGS[c].toLowerCase()} ${cell(i.scores![c].score)}: ${i.scores![c].reason}`).join('; ');
            lines.push(`- **${i.item}**: ${reasons}`);
        }
    }
    return `${lines.join('\n')}\n`;
};
