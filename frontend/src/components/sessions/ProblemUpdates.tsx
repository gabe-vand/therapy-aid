import { Link } from 'react-router-dom';
import type { SessionProblemUpdate } from '@therapy-aid/shared';
import { Card, Chip } from '@/components/ui/Card';
import { paths } from '@/services/paths';

/* "Problem updates": what this session did to each ongoing problem — a progress note, or the note
   that opened a new one (badged "new"). Each title links to the problem's own timeline. */
export const ProblemUpdates = ({ updates }: { updates: SessionProblemUpdate[] }) => {
    if (updates.length === 0) return null;
    return (
        <Card as="section" aria-labelledby="problem-updates-title">
            <h2 id="problem-updates-title" className="text-lg font-semibold">
                Problem updates
            </h2>
            <ul className="mt-4 flex flex-col gap-4">
                {updates.map((u) => (
                    <li key={`${u.problem_id}-${u.body}`}>
                        <div className="flex flex-wrap items-center gap-2">
                            <Link to={paths.problem(u.problem_id)} className="font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--accent)' }}>
                                {u.problem_title}
                            </Link>
                            {u.is_new_problem && <Chip tone="accent">new</Chip>}
                        </div>
                        <p className="mt-1 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                            {u.body}
                        </p>
                    </li>
                ))}
            </ul>
        </Card>
    );
};
