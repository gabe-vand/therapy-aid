import type { SessionListItem, SessionStatus } from '@therapy-aid/shared';
import { group_by_month } from './rhythm';
import { SessionRow } from './SessionRow';
import './sessions-timeline.css';

/* The Sessions list as a timeline: a 2px rail down the left with one node per session, coloured by
   where it is in the pipeline (ready ok, processing accent and pulsing, failed danger, otherwise
   a quiet hollow node), and the month names riding the rail as sticky eyebrows. Each month is a
   labelled region so a screen reader can jump between them; the rows themselves are SessionRow. */

type Node = 'ready' | 'processing' | 'failed' | 'idle';

const NODE: Record<SessionStatus, Node> = { ready: 'ready', uploaded: 'processing', transcribing: 'processing', summarizing: 'processing', failed: 'failed', recording: 'idle' };

export const SessionTimeline = ({ sessions }: { sessions: SessionListItem[] }) => (
    <div className="ta-tl">
        {group_by_month(sessions).map((group) => (
            <section key={group.month} aria-label={group.month} className="ta-tl__month">
                <h2 className="ta-tl__label">{group.month}</h2>
                <ol className="ta-tl__list">
                    {group.items.map((s) => (
                        <li key={s.id} className="ta-tl__item">
                            <span className="ta-tl__node" data-node={NODE[s.status]} aria-hidden />
                            <SessionRow session={s} />
                        </li>
                    ))}
                </ol>
            </section>
        ))}
    </div>
);
