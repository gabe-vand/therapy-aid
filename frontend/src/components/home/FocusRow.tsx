import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, CornerDownRight } from 'lucide-react';
import type { FocusItem } from '@therapy-aid/shared';
import { paths } from '@/services/paths';
import { WeekCheckins } from './WeekCheckins';
import type { WeekDay } from './week';
import './home-focus.css';
import './home-week.css';

/* One focus item on the check-in board: what to work on (title) and the one thing to do this
   week (action) on the left, the week's check-in circles on the right (under it on a phone). The
   "why" behind it — the long text the old banner led with — waits behind a "Why?" disclosure, and
   a small chip links the problem it came from when there is one. */

type Props = { item: FocusItem; week: WeekDay[]; done: Set<string>; problem_title: string | null; on_toggle: (day: string) => void };

export const FocusRow = ({ item, week, done, problem_title, on_toggle }: Props) => {
    const [open, set_open] = useState(false);
    const why_id = useId();
    return (
        <li className="ta-focus-row">
            <div className="ta-focus-row__main">
                <h3 className="ta-focus-row__title">{item.title}</h3>
                <p className="ta-focus-row__action">{item.action}</p>
                <div className="ta-focus-row__meta">
                    <button type="button" className="ta-why" aria-expanded={open} aria-controls={why_id} onClick={() => set_open((o) => !o)}>
                        Why?
                        <ChevronDown aria-hidden />
                    </button>
                    {item.problem_id !== null && (
                        <Link to={paths.problem(item.problem_id)} className="ta-problem-chip">
                            <CornerDownRight aria-hidden />
                            {problem_title ?? 'Related problem'}
                        </Link>
                    )}
                </div>
            </div>
            <WeekCheckins title={item.title} week={week} done={done} on_toggle={on_toggle} />
            <p id={why_id} hidden={!open} className="ta-focus-row__why">
                {item.why}
            </p>
        </li>
    );
};
