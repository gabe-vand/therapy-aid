import { Link } from 'react-router-dom';
import { ChevronRight, NotebookPen } from 'lucide-react';
import type { DashboardThread, Problem } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Card';
import { relative_time } from '@/services/dates';
import { paths } from '@/services/paths';
import { SessionDots } from './SessionDots';
import './problems.css';
import './problems-list.css';

/* One problem as a row: a status dot (active accent, stale warn, resolved ok), the title and the
   description's first line, then — from the dashboard, when it has answered — the dots of the last
   sessions that touched it, when it was last discussed, its note count and how often the journal
   mentioned it lately. The link stretches over the whole row; a stale problem's Keep / Discard sit
   above that overlay (buttons never nest inside an <a>) and drop to their own line on phones. */

export const activity_label = (p: Pick<Problem, 'last_discussed_at' | 'created_at'>): string => (p.last_discussed_at ? `Last discussed ${relative_time(p.last_discussed_at)}` : `Added ${relative_time(p.created_at)}, not discussed yet`);

type Tone = 'active' | 'stale' | 'resolved';
const tone_of = (p: Problem): Tone => (p.status === 'resolved' ? 'resolved' : p.is_stale ? 'stale' : 'active');

type Props = { problem: Problem; thread?: DashboardThread; busy?: boolean; on_keep?: (p: Problem) => void; on_discard?: (p: Problem) => void };

export function ProblemRow({ problem, thread, busy = false, on_keep, on_discard }: Props) {
    const count = problem.update_count;
    const mentions = thread?.journal_mentions ?? 0;
    return (
        <div className="ta-prow" data-tone={tone_of(problem)}>
            <span className="ta-prow__dot" aria-hidden />
            <Link to={paths.problem(problem.id)} className="ta-prow__link">
                <span className="ta-prow__title">
                    {problem.title}
                    {problem.is_stale && <Chip tone="warn">Stale</Chip>}
                    {problem.status === 'resolved' && <Chip tone="ok">Resolved</Chip>}
                </span>
                {problem.description && <p className="ta-prow__desc">{problem.description}</p>}
                {thread && <SessionDots marks={thread.marks} />}
                <span className="ta-prow__meta">
                    <span className="ta-prow__when">{activity_label(problem)}</span>
                    <span className="ta-prow__counts">
                        <span>
                            {count} {count === 1 ? 'update' : 'updates'}
                        </span>
                        {mentions > 0 && (
                            <span className="ta-prow__mentions" title="Journal mentions in the last 30 days">
                                <NotebookPen aria-hidden />
                                {mentions} in journal
                            </span>
                        )}
                    </span>
                </span>
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
            <ChevronRight size={16} aria-hidden className="ta-prow__chev" />
        </div>
    );
}
