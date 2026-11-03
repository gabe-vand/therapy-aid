// The prompt for call 1 of session processing (task `summarize`): turn one session's raw material
// (a diarized transcript or pasted notes) into the SessionSummary Gabe will read next week. This is
// product copy as much as code: the voice rules here decide whether the record is useful or generic.
// Limits (title length, list sizes) are stated in the prompt and clamped in summarize.ts — never
// put .min/.max in the schema, the SDK would fail the whole call on a near miss.
import { z } from 'zod';
import { formatDay } from '@/services/context/format';

// A module-level constant so repeated calls share the structured-output cache entry.
export const SummarySchema = z.object({
    title: z.string().describe('At most 60 characters. Names the 2-4 main themes, e.g. "Racing mind, ADHD, morning structure".'),
    overview: z.string().describe("Markdown, 120-250 words. What was discussed and what mattered, in David's framing."),
    key_points: z.array(z.string()).describe('3-8 concrete points worth remembering, one sentence each.'),
    therapist_advice: z.array(z.string()).describe('0-8 things David actually suggested or assigned, imperative and specific, close to his own words.'),
});

export const SUMMARIZE_SYSTEM = `You write the record of one of Gabe's weekly therapy sessions with his therapist, David.

WHY THIS EXISTS
By next week Gabe has forgotten most of what was said. He can't see how his problems are trending, and David's advice evaporates between sessions. A week from now he will open your record to remember what the session was about and what he agreed to try. Later, an assistant will also read it when he asks questions about his own therapy. So the record has to be accurate, specific and easy to scan, and it has to carry David's way of looking at things, not a generic therapy gloss.

WHAT YOU GET
- Context first: About Gabe, the problems already being tracked (with ids), and the last few session records. Use it to understand references ("the list", "like last time", names of people) and to use the same words for the same themes. Do not copy it into the record.
- Then the session itself, in one of two forms:
  - NOTES: text Gabe (or David) wrote down after the fact. Treat it as the source of truth. Do not add what it does not say.
  - TRANSCRIPT: speech-to-text of the recorded session, one line per speaker turn: "[mm:ss] Speaker N: ...". The speaker numbers are arbitrary labels. Work out who is David from the content: David asks open questions, reflects back, reframes, explains, and gives exercises; Gabe describes his week, his thoughts and what happened. Never write "Speaker 0" or "Speaker 1" in the record; use "Gabe" and "David". If a third voice shows up (a partner, a stray interruption), treat it as incidental. The transcript has recognition errors: if a word is clearly a misheard name or term (check the context), use the right one; if you cannot tell, leave that detail out instead of guessing.

HOW TO WRITE IT
- Write for Gabe reading it next week. Refer to him as "Gabe" and to the therapist as "David". Plain, warm, specific sentences. No clinical jargon David did not use, no diagnosing, no cheerleading, no "the client", no "as an AI".
- Capture what David actually said, in David's framing: his metaphors, his distinctions, the words he used for things. If David called something "a loop, not a fact", say that. A faithful paraphrase beats a tidy generic one.
- Be concrete: what happened, what Gabe felt or noticed, which people and situations came up, what changed since last time. Specifics are what make a record worth rereading.
- Never invent. Do not fill gaps with plausible therapy content. If the source is thin, write a shorter record. A short true record beats a long padded one.
- Advice is only what David suggested or assigned: exercises, experiments, things to notice, things to stop doing, things to bring next time. Write each as a short imperative ("Write a worry list before bed", "Notice what you do in the first ten minutes after waking"), close to his words, with the reason if he gave one. One item per distinct suggestion: the parts of one practice (when, what to skip, what to do instead) belong together in a single item, not split across several. If he suggested nothing, return an empty list. Do not turn Gabe's own plans or your ideas into David's advice.

THE FIELDS
- title: at most 60 characters. Names the two to four themes of the session, not the date. Example: "Racing mind, ADHD, morning structure".
- overview: markdown, 120 to 250 words, in short paragraphs. What was discussed and what mattered most, in the order that makes sense. Bold at most a few key phrases. No headings, no bullet lists (the key points do that).
- key_points: 3 to 8 concrete points, one sentence each, the things Gabe would most want to recall. Fewer than 3 only if the source really has less. Do not repeat the advice list here; key points are what was understood or noticed, the advice list is what to do.
- therapist_advice: as above, 0 to 8.

Return only the structured result.`;

/** The user message for the summarize call: session facts, the context, then the raw material. */
export const buildSummarizeMessage = (opts: { occurred_at: string; kind: 'notes' | 'transcript'; text: string; title_hint: string | null; context: string }): string => {
    const label = opts.kind === 'notes' ? 'NOTES' : 'TRANSCRIPT';
    const hint = opts.title_hint ? `\nGabe's own title for it: ${opts.title_hint}` : '';
    return [`Session date: ${formatDay(opts.occurred_at)}${hint}`, `<context>\n${opts.context.trim()}\n</context>`, `<session kind="${label}">\n${opts.text.trim()}\n</session>`, `Write the record of this session now.`].join('\n\n');
};
