import { Link } from 'react-router-dom';
import type { SessionListItem } from '@therapy-aid/shared';
import { format_date } from '@/services/dates';
import { paths } from '@/services/paths';
import { SOURCE_LABEL, StatusChip } from './StatusChip';
import './sessions.css';

/* One tappable row of the Sessions list (and the body of Home's last-session card): title, the
   day it happened, how it came in, and where the pipeline is. The whole row is the link. */
export const SessionRow = ({ session }: { session: SessionListItem }) => (
    <Link to={paths.session(session.id)} className="ta-session-row">
        <div className="min-w-0">
            <p className="truncate font-semibold">{session.title ?? 'Untitled session'}</p>
            <p className="ta-muted mt-0.5 text-sm">
                {format_date(session.occurred_at, { weekday: true })} · {SOURCE_LABEL[session.source]}
            </p>
        </div>
        <StatusChip status={session.status} />
    </Link>
);
