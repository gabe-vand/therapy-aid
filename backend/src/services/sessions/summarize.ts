// Call 1 of session processing (task `summarize`): the session's notes or transcript, plus the
// context (profile, tracked problems, last three sessions), become a SessionSummary. The model is
// told the limits in the prompt; they are enforced here, because a schema limit would fail the
// whole call on a near miss instead of trimming it.
import type { SessionSummary } from '@therapy-aid/shared';
import type { SessionRow } from '@/repositories/sessions';
import * as svc_claude from '@/services/common/svc-claude';
import { buildSummarizationContext } from '@/services/context/context-pack';
import { buildSummarizeMessage, SUMMARIZE_SYSTEM, SummarySchema } from './prompts';

const MAX_TITLE = 60;
const MAX_POINTS = 8;
const MAX_ADVICE = 8;

/** Cuts a title to 60 characters at a word boundary when it can, with an ellipsis. */
export const clampTitle = (title: string): string => {
    const t = title.trim().replace(/\s+/g, ' ');
    if (t.length <= MAX_TITLE) return t;
    const cut = t.slice(0, MAX_TITLE - 1);
    const space = cut.lastIndexOf(' ');
    return `${(space > 30 ? cut.slice(0, space) : cut).replace(/[\s,;:-]+$/, '')}…`;
};

const cleanList = (items: string[], max: number): string[] =>
    items
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, max);

/** Normalises whatever the model returned into a SessionSummary within the documented limits. */
export const clampSummary = (raw: SessionSummary, fallback_title: string | null): SessionSummary => ({
    title: clampTitle(raw.title) || fallback_title || 'Untitled session',
    overview: raw.overview.trim(),
    key_points: cleanList(raw.key_points, MAX_POINTS),
    therapist_advice: cleanList(raw.therapist_advice, MAX_ADVICE),
});

/** The text the summarizer reads for this session: its notes, or its transcript. */
export const sourceText = (session: SessionRow): { kind: 'notes' | 'transcript'; text: string } | null => {
    const text = (session.source === 'notes' ? session.notes : session.transcript)?.trim();
    return text ? { kind: session.source === 'notes' ? 'notes' : 'transcript', text } : null;
};

/** Summarizes one session. Throws AiError (or an SDK error) when the call fails. */
export const summarizeSession = async (session: SessionRow): Promise<SessionSummary> => {
    const source = sourceText(session);
    if (!source) throw new Error(session.source === 'notes' ? 'This session has no notes to summarize.' : 'This recording has no transcript to summarize.');
    const context = buildSummarizationContext({ before: session.occurred_at, exclude_session_id: session.id });
    const raw = await svc_claude.completeStructured({
        task: 'summarize',
        system: svc_claude.systemBlocks([SUMMARIZE_SYSTEM]),
        messages: [{ role: 'user', content: buildSummarizeMessage({ occurred_at: session.occurred_at, ...source, title_hint: session.title, context }) }],
        schema: SummarySchema,
    });
    return clampSummary(raw, session.title);
};
