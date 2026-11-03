import { Link } from 'react-router-dom';
import type { SessionProblemUpdate } from '@therapy-aid/shared';
import { Chip } from '@/components/ui/Card';
import { paths } from '@/services/paths';
import { DetailSection } from './SummaryBody';
import './session-detail.css';

/* "Problems this session touched": what this session did to each ongoing problem — a progress
   note, or the note that opened a new one (a "New" chip). Hairline rows; each title links to the
   problem's timeline. Nothing renders when the session touched no problem. */
export const ProblemUpdates = ({ updates }: { updates: SessionProblemUpdate[] }) => {
    if (updates.length === 0) return null;
    return (
        <DetailSection id="problems" title="Problems this session touched">
            <ul className="ta-touched">
                {updates.map((u) => (
                    <li key={`${u.problem_id}-${u.body}`} className="ta-touched__item">
                        <div className="ta-touched__head">
                            <Link to={paths.problem(u.problem_id)}>{u.problem_title}</Link>
                            {u.is_new_problem && <Chip tone="accent">New</Chip>}
                        </div>
                        <p>{u.body}</p>
                    </li>
                ))}
            </ul>
        </DetailSection>
    );
};
