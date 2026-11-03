import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Dashboard } from '@therapy-aid/shared';
import { Card, Chip } from '@/components/ui/Card';
import { format_date } from '@/services/dates';
import { paths } from '@/services/paths';
import './home-last.css';

/* "From your last session": the newest ready session's title and date, then what David suggested,
   as a tight list with an accent rule per item — his words are the most useful thing to have at
   hand between sessions. Home hides this block until there is a session. */

type Last = NonNullable<Dashboard['sessions']['last']>;

export const LastSessionCard = ({ last }: { last: Last }) => (
    <section aria-labelledby="last-session-title" className="ta-home-block">
        <h2 id="last-session-title" className="ta-eyebrow ta-block-head">
            From your last session
        </h2>
        <Card className="ta-last">
            <div className="ta-last__head">
                <div className="min-w-0">
                    <Link to={paths.session(last.id)} className="ta-last__title">
                        {last.title ?? 'Untitled session'}
                    </Link>
                    <p className="ta-last__date">{format_date(last.occurred_at, { weekday: true })}</p>
                </div>
                <Chip tone="ok">Ready</Chip>
            </div>
            {last.advice.length > 0 ? (
                <>
                    <p className="ta-eyebrow">What David suggested</p>
                    <ul className="ta-advice">
                        {last.advice.map((a, i) => (
                            <li key={i}>{a}</li>
                        ))}
                    </ul>
                </>
            ) : (
                <p className="ta-last__none">No suggestions were recorded for this session.</p>
            )}
            <Link to={paths.session(last.id)} className="ta-last__open">
                Open session
                <ArrowRight aria-hidden />
            </Link>
        </Card>
    </section>
);
