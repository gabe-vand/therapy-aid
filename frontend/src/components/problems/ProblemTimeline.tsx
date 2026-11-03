import { Link } from 'react-router-dom';
import type { ProblemUpdate } from '@therapy-aid/shared';
import { Chip } from '@/components/ui/Card';
import { format_date } from '@/services/dates';
import { paths } from '@/services/paths';
import './problems.css';

/* The story of a problem, newest first: each progress note with its date, where it came from (a
   link to the session it was drawn from, or a "manual" tag when Gabe typed it) and its text.
   AI notes are dated by their session, so the timeline reads in the order things were discussed. */

export function ProblemTimeline({ updates }: { updates: ProblemUpdate[] }) {
    if (updates.length === 0) {
        return <p className="ta-muted text-[15px]">No notes yet. They are added after each session, or you can add your own above.</p>;
    }
    return (
        <ol className="ta-timeline" aria-label="Timeline">
            {updates.map((u) => (
                <li key={u.id} className="ta-timeline__item">
                    <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                        <span className="ta-muted font-medium">{format_date(u.created_at, { weekday: true })}</span>
                        {u.source === 'manual' && <Chip tone="neutral">manual</Chip>}
                        {u.session_id !== null && (
                            <Link to={paths.session(u.session_id)} className="font-medium" style={{ color: 'var(--accent)' }}>
                                {u.session_title ?? 'Session'}
                            </Link>
                        )}
                    </div>
                    <p className="whitespace-pre-wrap text-[15px]">{u.body}</p>
                </li>
            ))}
        </ol>
    );
}
