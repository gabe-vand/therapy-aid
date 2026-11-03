// Stage one of a margin note: which problem is this paragraph about? A Haiku call (task
// 'classify') over the active problem list, cheap enough to run on every paragraph Gabe
// finishes. The problem list is rendered deterministically so it caches between calls; the
// paragraph is the whole user message. Returns null when nothing links with enough confidence.
import * as repo_problems from '@/repositories/problems';
import type { ProblemRow } from '@/repositories/problems';
import { completeStructured, systemBlocks } from '@/services/common/svc-claude';
import { buildClassifyMessage, CLASSIFY_SYSTEM, ClassifySchema } from './prompts';

export const MIN_LINK_CONFIDENCE = 0.6;
const DESCRIPTION_CHARS = 220;

export interface ParagraphLink {
    problem: ProblemRow;
    confidence: number;
    because: string;
}

/** The problem list as the classifier sees it: one line per active problem, ids first. */
export const renderProblemsForClassify = (problems: ProblemRow[]): string =>
    `# Gabe's problems\n\n${problems.map((p) => `- [problem #${p.id}] ${p.title} — ${p.description.trim().replace(/\s+/g, ' ').slice(0, DESCRIPTION_CHARS) || 'no description'}`).join('\n')}`;

/** Labels one paragraph. Null when there are no active problems, the model picks none, the id
    is not an active problem, or confidence is below MIN_LINK_CONFIDENCE. */
export const classifyParagraph = async (paragraph: string): Promise<ParagraphLink | null> => {
    const active = repo_problems.selectProblemsByStatus(['active']).sort((a, b) => a.id - b.id);
    if (active.length === 0) return null;

    const reply = await completeStructured({
        task: 'classify',
        system: systemBlocks([CLASSIFY_SYSTEM, renderProblemsForClassify(active)]),
        messages: [{ role: 'user', content: buildClassifyMessage(paragraph) }],
        schema: ClassifySchema,
        max_tokens: 300,
    });

    const confidence = Math.max(0, Math.min(1, Number.isFinite(reply.confidence) ? reply.confidence : 0));
    const problem = reply.problem_id === null ? undefined : active.find((p) => p.id === reply.problem_id);
    if (!problem || confidence < MIN_LINK_CONFIDENCE) return null;
    return { problem, confidence, because: reply.because.trim() };
};
