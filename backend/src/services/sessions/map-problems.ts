// Call 2 of session processing (task `map_problems`): the finished summary (about 1k tokens, not
// the transcript) plus the tracked-problem list become a ProblemExtraction: which existing
// problems moved, and which durable new ones opened. Narrow on purpose — it is what lets a cheaper
// model do this job without drifting. Counts and lengths are clamped here, not in the schema.
import type { SessionSummary } from '@therapy-aid/shared';
import * as svc_claude from '@/services/common/svc-claude';
import { buildProblemMappingContext } from '@/services/context/context-pack';
import { buildMapMessage, MAP_PROBLEMS_SYSTEM, ProblemExtractionSchema, type ProblemExtraction } from './prompts-map';

export const MAX_NEW_PROBLEMS = 3;
const MAX_TITLE = 80;

const trimTo = (text: string, max: number): string => {
    const t = text.trim();
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Trims text, drops entries with no usable note or title, caps new problems at 3. */
export const clampExtraction = (raw: ProblemExtraction): ProblemExtraction => ({
    problem_updates: raw.problem_updates.map((u) => ({ ...u, progress_note: u.progress_note.trim() })).filter((u) => u.progress_note),
    new_problems: raw.new_problems
        .map((p) => ({ title: trimTo(p.title, MAX_TITLE), description: p.description.trim(), progress_note: p.progress_note.trim() }))
        .filter((p) => p.title)
        .slice(0, MAX_NEW_PROBLEMS),
});

/** Maps one session's summary onto the problem list. Throws AiError (or an SDK error) on failure. */
export const mapProblems = async (occurred_at: string, summary: SessionSummary): Promise<ProblemExtraction> => {
    const raw = await svc_claude.completeStructured({
        task: 'map_problems',
        system: svc_claude.systemBlocks([MAP_PROBLEMS_SYSTEM]),
        messages: [{ role: 'user', content: buildMapMessage({ occurred_at, summary, problems_context: buildProblemMappingContext() }) }],
        schema: ProblemExtractionSchema,
    });
    return clampExtraction(raw);
};
