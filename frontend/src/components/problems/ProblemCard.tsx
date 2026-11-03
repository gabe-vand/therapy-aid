import { Link } from 'react-router-dom';
import type { Problem } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Card, Chip } from '@/components/ui/Card';
import { relative_time } from '@/services/dates';
import { paths } from '@/services/paths';

/* One problem on the list: title, a 2-line description, "last discussed 3 weeks ago" and the
   update count. The whole top area is one link to the detail page; a stale problem grows a
   "Still relevant?" strip with Keep / Discard UNDER the link (buttons never nest inside an <a>). */

export const activity_label = (p: Pick<Problem, 'last_discussed_at' | 'created_at'>): string => (p.last_discussed_at ? `Last discussed ${relative_time(p.last_discussed_at)}` : `Added ${relative_time(p.created_at)}, not discussed yet`);

type Props = { problem: Problem; busy?: boolean; on_keep?: (p: Problem) => void; on_discard?: (p: Problem) => void };

export function ProblemCard({ problem, busy = false, on_keep, on_discard }: Props) {
    const count = problem.update_count;
    return (
        <Card as="article" padded={false} style={problem.is_stale ? { borderColor: 'var(--warn)' } : undefined}>
            <Link to={paths.problem(problem.id)} className="block rounded-2xl p-5 no-underline hover:bg-[var(--surface-2)]" style={{ color: 'inherit' }}>
                <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-[17px] font-semibold leading-snug">{problem.title}</h3>
                    {problem.is_stale && <Chip tone="warn">Stale</Chip>}
                    {problem.status === 'resolved' && <Chip tone="ok">Resolved</Chip>}
                </div>
                {problem.description && <p className="ta-muted mt-1.5 line-clamp-2 text-[15px]">{problem.description}</p>}
                <p className="ta-muted mt-3 text-[13px]">
                    {activity_label(problem)} · {count} {count === 1 ? 'update' : 'updates'}
                </p>
            </Link>
            {problem.is_stale && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: 'var(--line)', background: 'var(--warn-soft)', borderRadius: '0 0 16px 16px' }}>
                    <span className="text-[14px] font-medium" style={{ color: 'var(--warn)' }}>
                        Still relevant?
                    </span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => on_keep?.(problem)}>
                            Keep
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => on_discard?.(problem)}>
                            Discard
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}
