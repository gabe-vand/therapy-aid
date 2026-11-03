import type { FocusSnapshot, Problem } from '@therapy-aid/shared';

/* The suggested questions an empty conversation offers, built from Gabe's own material so they are
   worth tapping: what to bring up next, how the top focus item is going, what David said about the
   two most recently discussed problems, the last session, and the journal. At most six. Pure. */

export const MAX_STARTERS = 6;

// "Racing mind at night" → "racing mind at night" (but "ADHD and focus" keeps its capitals).
const in_sentence = (title: string): string => {
    const first = title.split(/\s+/)[0] ?? '';
    return first.length > 1 && first === first.toUpperCase() ? title : title.charAt(0).toLowerCase() + title.slice(1);
};

const recently_discussed = (problems: Problem[], n: number): Problem[] =>
    problems
        .filter((p) => p.status === 'active' && p.last_discussed_at !== null)
        .sort((a, b) => (a.last_discussed_at! < b.last_discussed_at! ? 1 : a.last_discussed_at! > b.last_discussed_at! ? -1 : 0))
        .slice(0, n);

export const starter_questions = ({ focus, problems }: { focus: FocusSnapshot | null; problems: Problem[] }): string[] => {
    const top = focus?.items[0]?.title.trim();
    const questions = [
        'What should I bring up next session?',
        ...(top ? [`How has “${in_sentence(top)}” been going?`] : []),
        ...recently_discussed(problems, 2).map((p) => `What did David say about ${in_sentence(p.title.trim())}?`),
        'Summarise my last session',
        'What patterns show up in my journal lately?',
    ];
    return questions.slice(0, MAX_STARTERS);
};
