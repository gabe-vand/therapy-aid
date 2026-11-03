import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import type { SessionProblemUpdate } from '@therapy-aid/shared';
import { Chip } from '@/components/ui/Card';
import { paths } from '@/services/paths';
import './sessions.css';

/* "Problem updates": what this session did to each ongoing problem — a progress note, or the note
   that opened a new one (badged "new"). A quiet list on the page; each title links to the
   timeline of its problem. */
export const ProblemUpdates = ({ updates }: { updates: SessionProblemUpdate[] }) => {
    if (updates.length === 0) return null;
    return (
        <section aria-labelledby="problem-updates-title">
            <h2 id="problem-updates-title" className="ta-label">
                Problem updates
            </h2>
            <ul className="ta-updates">
                {updates.map((u) => (
                    <li key={`${u.problem_id}-${u.body}`}>
                        <div className="ta-updates__head">
                            <Target size={16} aria-hidden />
                            <Link to={paths.problem(u.problem_id)}>{u.problem_title}</Link>
                            {u.is_new_problem && <Chip tone="accent">new</Chip>}
                        </div>
                        <p>{u.body}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
};
