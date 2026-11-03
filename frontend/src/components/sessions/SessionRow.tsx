import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { SessionListItem } from '@therapy-aid/shared';
import { format_date } from '@/services/dates';
import { paths } from '@/services/paths';
import { SOURCE_LABEL, StatusChip } from './StatusChip';
import './sessions.css';

/* One tappable row of the Sessions list (and the body of Home's last-session card): title, the
   day it happened, how it came in, where the pipeline is, and a chevron. The whole row is the link. */
export const SessionRow = ({ session }: { session: SessionListItem }) => (
    <Link to={paths.session(session.id)} className="ta-session-row">
        <div className="min-w-0">
            <p className="ta-session-row__title">{session.title ?? 'Untitled session'}</p>
            <p className="ta-session-row__date">
                {format_date(session.occurred_at, { weekday: true })} · {SOURCE_LABEL[session.source]}
            </p>
        </div>
        <span className="ta-session-row__end">
            <StatusChip status={session.status} />
            <ChevronRight size={16} aria-hidden />
        </span>
    </Link>
);
