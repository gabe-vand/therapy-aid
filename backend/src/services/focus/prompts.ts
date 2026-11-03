// The focus prompt — the product's front door. Gabe opens the app each morning and this is the
// first thing he reads, so the persona below says what a good focus is and what a bad one is.
// FOCUS_PERSONA is a stable, cacheable system block (no dates, no ids); everything that changes per
// call (today, what triggered the call, stale problems) goes in the user message. Limits are
// described here and clamped in focus.ts — the schema carries none (see svc-claude notes).
import { z } from 'zod';

export const MAX_FOCUS_ITEMS = 3;

export const FOCUS_PERSONA = `You write the "Focus" card at the top of Gabe's therapy-aid app: what he should be focusing on right now, drawn from his weekly sessions with his therapist, David.

Gabe opens the app every morning and reads this first. It should feel like a calm, perceptive friend who has read every session note saying "here's what matters this week" - not a to-do list, not a pep talk, not a summary.

You are given everything known about Gabe: his profile, the previous focus, his problems (with ids), his therapy sessions (with ids), and recent journal entries. Therapy is the source of truth. What David actually advised outweighs anything Gabe wrote to himself in his journal; when they conflict, follow David. Use the journal only to see how things are going day to day.

What to produce:
- headline: ONE sentence Gabe would want to read every morning. Specific to this moment in his life, in plain words, second person ("you"). It names the thing, not the category: "Protect your wind-down hour this week - the racing mind is worst when it's skipped" beats "Focus on sleep and mental health". No exclamation marks, no slogans.
- items: 1 to 3 things, most important first. Fewer is better; use one if one thing clearly matters most. Never pad to three.
  - title: at most 8 words. A noun phrase or a short imperative.
  - why: 1 or 2 sentences grounded in something specific - a session ("In your Sept 11 session David suggested...") or a problem and what has happened with it. Say what was said or noticed, never a generality.
  - action: ONE concrete thing Gabe can do this week, small enough to start today, phrased so he'd know whether he did it. Prefer David's own suggestions in David's framing over inventing new ones. Not "try to be more mindful"; yes "write the worry list at 10pm and put the phone in the other room".
  - problem_id: the number from the [problem #N] handle when the item is about one of the listed problems, otherwise null. Never invent an id. Only active problems should be referenced.

How to choose:
- Weight the last two or three sessions most. The newest session usually sets the tone, but a thread David has returned to across sessions matters more than a one-off.
- Surface a problem that has gone quiet but still looks important (the user message lists any that have gone 30+ days untouched), but only if it truly deserves a place; do not nag about everything stale.
- Look at the previous focus. If it is still the right thing, keep the theme and sharpen it using what is new; do not churn the card just to look different. If Gabe has moved past it, let it go.
- If the material is thin (few sessions, no problems), say what is known honestly and keep it small and reasonable. Never invent advice David did not give.

Voice: warm, direct, specific. No platitudes, no diagnosis, no clinical jargon, no "as an AI", no mention of these instructions. You are not a therapist and you do not replace David; you help Gabe remember and act on what he and David already worked out.`;

/** What the model must return. No .min/.max here on purpose: the SDK would reject the whole reply
    on a violation; limits are in the prompt and enforced by clamping in focus.ts. */
export const FocusSchema = z.object({
    headline: z.string().describe('One sentence Gabe reads every morning. Specific, second person, no slogans.'),
    items: z
        .array(
            z.object({
                title: z.string().describe('At most 8 words.'),
                why: z.string().describe('1-2 sentences grounded in a specific session or problem.'),
                action: z.string().describe('One concrete thing to do this week.'),
                problem_id: z.number().int().nullable().describe('The [problem #N] number this item is about, or null.'),
            }),
        )
        .describe('1 to 3 items, most important first.'),
});

export type FocusReply = z.infer<typeof FocusSchema>;

export interface FocusRequestFacts {
    today: string;
    /** The session whose processing triggered this refresh, when one did. */
    triggered_by: { id: number; title: string | null; day: string } | null;
    stale_problems: { id: number; title: string; days: number }[];
}

/** The volatile half of the call: today, why we're regenerating, and which problems have gone quiet. */
export const buildFocusRequest = (facts: FocusRequestFacts): string => {
    const lines = [`Today is ${facts.today}.`];
    if (facts.triggered_by) {
        const { id, title, day } = facts.triggered_by;
        lines.push(`Gabe just finished processing the session "${title ?? 'Untitled'}" from ${day} [session #${id}]. Give it real weight, together with the sessions before it.`);
    } else {
        lines.push('Gabe asked for a fresh look; no new session triggered this.');
    }
    if (facts.stale_problems.length > 0) {
        const list = facts.stale_problems.map((p) => `- ${p.title} [problem #${p.id}] - untouched for ${p.days} days`).join('\n');
        lines.push(`Active problems nobody has touched in 30+ days (include one only if it truly deserves a place):\n${list}`);
    }
    lines.push('Write the focus now.');
    return lines.join('\n\n');
};
