import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ProblemUpdate } from '@therapy-aid/shared';
import { Chip } from '@/components/ui/Card';
import { format_date } from '@/services/dates';
import { paths } from '@/services/paths';
import './problems-timeline.css';

/* The story of a problem, newest first, on a vertical rail: each progress note is a node with its
   date as an eyebrow, where it came from (a "Session" chip and a link to the session it was drawn
   from, or "Your note" when Gabe typed it) and its text. `compose` (the add-note form) rides the
   top of the rail, so a new note visibly lands where it is written. AI notes are dated by their
   session, so the timeline reads in the order things were discussed. */

export function ProblemTimeline({ updates, compose }: { updates: ProblemUpdate[]; compose?: ReactNode }) {
    return (
        <div className="ta-ptl">
            {compose && (
                <div className="ta-ptl__compose">
                    <span className="ta-ptl__node" data-kind="compose" aria-hidden />
                    {compose}
                </div>
            )}
            {updates.length === 0 ? (
                <p className="ta-ptl__empty">No notes yet. They are added after each session, or you can add your own above.</p>
            ) : (
                <ol className="ta-ptl__list" aria-label="Timeline">
                    {updates.map((u) => (
                        <li key={u.id} className="ta-ptl__item">
                            <span className="ta-ptl__node" data-kind={u.source} aria-hidden />
                            <div className="ta-ptl__meta">
                                <span className="ta-ptl__date">{format_date(u.created_at, { weekday: true })}</span>
                                <Chip tone={u.source === 'manual' ? 'neutral' : 'accent'}>{u.source === 'manual' ? 'Your note' : 'Session'}</Chip>
                                {u.session_id !== null && <Link to={paths.session(u.session_id)}>{u.session_title ?? 'Session'}</Link>}
                            </div>
                            <p className="ta-ptl__body">{u.body}</p>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
