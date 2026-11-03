// The prompt for call 2 of session processing (task `map_problems`): given the finished summary
// (not the transcript, so the call stays small and narrow) and the list of tracked problems,
// decide which problems this session moved and whether it opened any durable new one. The
// schema carries no limits (see FOUNDATION notes); counts and lengths are clamped in code.
import { z } from 'zod';
import type { SessionSummary } from '@therapy-aid/shared';
import { formatDay } from '@/services/context/format';

export const ProblemExtractionSchema = z.object({
    problem_updates: z
        .array(
            z.object({
                problem_id: z.number().int().describe('The id from "[problem #N]" in the existing problems list. Never invent one.'),
                progress_note: z.string().describe('1-3 sentences: what changed, or what was said about this problem in this session.'),
                suggested_status: z.enum(['active', 'resolved']).describe('"active" unless the session clearly closes the problem.'),
            }),
        )
        .describe('One entry per existing problem this session touched; none for problems it did not touch.'),
    new_problems: z
        .array(
            z.object({
                title: z.string().describe('A short name for the theme, 2-6 words.'),
                description: z.string().describe("1-2 sentences saying what the problem is, in David's framing."),
                progress_note: z.string().describe('1-3 sentences: what was said about it in this session.'),
            }),
        )
        .describe('Usually 0, sometimes 1-2: durable themes with no existing problem that fits.'),
});

export type ProblemExtraction = z.infer<typeof ProblemExtractionSchema>;

export const MAP_PROBLEMS_SYSTEM = `You keep the list of "problems" in Gabe's therapy: the big-picture threads that run across his weekly sessions with David (for example "Racing mind at night" or "Conflict with Nicole"). Each time a session is recorded you decide how it moved those threads. Gabe uses this to see, week by week, what is changing and what keeps coming back.

WHAT YOU GET
The finished record of one session (title, overview, key points, what David suggested), and the existing problems, each with an id like [problem #3], a status, a description and its latest note.

WHAT TO DO
1. Map before you create. For every existing problem the session spoke to, write one progress note. Match loosely and generously: if the topic is the same thread, even under different words or from a different angle, it belongs to the existing problem. Prefer updating to creating, always. A near-duplicate problem is worse than a slightly stretched match.
2. Create a new problem only for a durable theme: something that will plausibly still matter in weeks and that no existing problem fits. A one-off event, a single decision or a passing mood is not a problem; it belongs in the session record. Zero new problems is normal; one or two is typical at most. Never create more than three.
3. Progress notes are 1 to 3 sentences. They state what changed or what was said about the problem in this session: what Gabe reported, what David pointed out or suggested, what moved. Write them so Gabe, reading the problem's timeline next month, sees the thread: concrete, past tense, no repeating the problem description, no filler ("this was discussed").
4. suggested_status: use "resolved" only when the session clearly closes the problem (Gabe says it is behind him and David agrees, or the cause is gone). Doubt means "active". Use "active" on an entry for a problem listed as resolved only if it has genuinely come back as a live issue; that reopens it. Do not mention a resolved problem otherwise.
5. Use David's framing in titles, descriptions and notes. Do not diagnose and do not invent: everything must be supported by the record you were given.
6. Each existing problem appears at most once. A problem the session did not touch gets no entry. The id must come from the list.

Return only the structured result.`;

/** The user message for the map_problems call: the new record, then the problems list. */
export const buildMapMessage = (opts: { occurred_at: string; summary: SessionSummary; problems_context: string }): string => {
    const { summary } = opts;
    const advice = summary.therapist_advice.length ? summary.therapist_advice.map((a) => `- ${a}`).join('\n') : '(none)';
    return [
        `<session date="${formatDay(opts.occurred_at)}">`,
        `Title: ${summary.title}`,
        `Overview:\n${summary.overview}`,
        `Key points:\n${summary.key_points.map((p) => `- ${p}`).join('\n')}`,
        `What David suggested:\n${advice}`,
        `</session>`,
        opts.problems_context.trim(),
        'Map this session onto the problems now.',
    ].join('\n\n');
};
