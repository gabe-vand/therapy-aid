import { Link } from 'react-router-dom';
import type { ProblemDetail } from '@therapy-aid/shared';
import { format_date, relative_time } from '@/services/dates';
import { paths } from '@/services/paths';
import './problems-timeline.css';

/* The facts strip under a problem's title, 12px and dot-separated: when it was opened (and from
   which session — its title comes from the timeline note that session wrote), when it was last
   discussed, how many notes it has, how often the journal has mentioned it. */
export function ProblemFacts({ problem }: { problem: ProblemDetail }) {
    const origin = problem.origin_session_id;
    const origin_title = origin === null ? null : (problem.updates.find((u) => u.session_id === origin)?.session_title ?? 'a session');
    const notes = problem.update_count;
    const mentions = problem.journal_mentions.length;
    return (
        <ul className="ta-facts" aria-label="About this problem">
            <li>
                Opened {format_date(problem.created_at, { year: false })}
                {origin !== null && (
                    <>
                        {' '}
                        from <Link to={paths.session(origin)}>{origin_title}</Link>
                    </>
                )}
            </li>
            <li>{problem.last_discussed_at ? `Last discussed ${relative_time(problem.last_discussed_at)}` : 'Not discussed yet'}</li>
            <li>
                {notes} {notes === 1 ? 'note' : 'notes'}
            </li>
            {mentions > 0 && (
                <li>
                    {mentions} journal {mentions === 1 ? 'mention' : 'mentions'}
                </li>
            )}
        </ul>
    );
}
