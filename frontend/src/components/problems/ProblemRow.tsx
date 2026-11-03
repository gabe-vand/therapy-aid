import { Link } from 'react-router-dom';
import type { Problem } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Card';
import { relative_time } from '@/services/dates';
import { paths } from '@/services/paths';
import './problems.css';

/* One problem as a row in the bordered list: title, a one-line description, "Last discussed 3
   weeks ago · 4 updates" and the status chip. The text area is one link to the detail page; a
   stale problem grows inline Keep / Discard buttons NEXT to the link (buttons never nest inside
   an <a>) — on phones they drop to a line of their own under it. */

export const activity_label = (p: Pick<Problem, 'last_discussed_at' | 'created_at'>): string => (p.last_discussed_at ? `Last discussed ${relative_time(p.last_discussed_at)}` : `Added ${relative_time(p.created_at)}, not discussed yet`);

type Props = { problem: Problem; busy?: boolean; on_keep?: (p: Problem) => void; on_discard?: (p: Problem) => void };

export function ProblemRow({ problem, busy = false, on_keep, on_discard }: Props) {
    const count = problem.update_count;
    return (
        <div className="ta-prow">
            <Link to={paths.problem(problem.id)} className="ta-prow__link">
                <span className="ta-prow__text">
                    <span className="ta-prow__title">{problem.title}</span>
                    {problem.description && <p className="ta-prow__desc">{problem.description}</p>}
                    <p className="ta-prow__meta">
                        {activity_label(problem)} · {count} {count === 1 ? 'update' : 'updates'}
                    </p>
                </span>
                {problem.is_stale && <Chip tone="warn">Stale</Chip>}
                {problem.status === 'resolved' && <Chip tone="ok">Resolved</Chip>}
            </Link>
            {problem.is_stale && (
                <div className="ta-prow__actions">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => on_keep?.(problem)}>
                        Keep
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => on_discard?.(problem)}>
                        Discard
                    </Button>
                </div>
            )}
        </div>
    );
}
