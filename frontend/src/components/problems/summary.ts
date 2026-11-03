import type { Problem } from '@therapy-aid/shared';

/* The Problems page subtitle as counts instead of a slogan: "4 active · 1 going quiet · 2
   resolved". Pure, so it is tested on its own; the empty list keeps the old explanation. */
export const problems_sentence = (problems: Problem[]): string => {
    const active = problems.filter((p) => p.status === 'active');
    if (problems.length === 0) return 'The themes that keep coming up, and how they are moving.';
    const quiet = active.filter((p) => p.is_stale).length;
    const resolved = problems.filter((p) => p.status === 'resolved').length;
    return [`${active.length} active`, ...(quiet > 0 ? [`${quiet} going quiet`] : []), ...(resolved > 0 ? [`${resolved} resolved`] : [])].join(' · ');
};
