import { Link } from 'react-router-dom';
import { NotebookPen } from 'lucide-react';
import type { DashboardThread } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Card';
import { Dots } from '@/components/ui/Dots';
import { paths } from '@/services/paths';
import { days_since } from './week';
import './home-threads.css';

/* One active problem as a row of the Threads grid: its title (the row's link, stretched over the
   whole row), a "quiet Nw" chip when it has gone stale, a dot per recent session (filled where
   that session touched it) and how often the journal mentioned it in 30 days. A stale row carries
   Keep / Discard inline — the old "Still relevant?" section folded into the grid. */

type Props = { thread: DashboardThread; dot_titles: string[]; busy: boolean; on_keep: () => void; on_discard: () => void };

const quiet_label = (iso: string | null): string => {
    if (!iso) return 'quiet';
    const weeks = Math.floor(days_since(iso) / 7);
    return weeks > 0 ? `quiet ${weeks}w` : 'quiet';
};

export const ThreadRow = ({ thread, dot_titles, busy, on_keep, on_discard }: Props) => {
    const hits = thread.marks.filter(Boolean).length;
    return (
        <li className={`ta-thread${thread.is_stale ? ' is-stale' : ''}`}>
            <div className="ta-thread__main">
                <Link to={paths.problem(thread.id)} className="ta-thread__link">
                    {thread.title}
                </Link>
                {thread.is_stale && <Chip tone="warn">{quiet_label(thread.last_discussed_at)}</Chip>}
            </div>
            {thread.is_stale && (
                <div className="ta-thread__actions">
                    <Button size="sm" variant="ghost" onClick={on_keep} disabled={busy} aria-label={`Keep ${thread.title}`}>
                        Keep
                    </Button>
                    <Button size="sm" variant="ghost" onClick={on_discard} disabled={busy} aria-label={`Discard ${thread.title}`}>
                        Discard
                    </Button>
                </div>
            )}
            <Dots className="ta-thread__dots" marks={thread.marks} titles={dot_titles} label={`Discussed in ${hits} of ${thread.marks.length} sessions`} />
            <span className="ta-thread__mentions ta-num" title="Journal mentions, last 30 days">
                {thread.journal_mentions > 0 && (
                    <>
                        <NotebookPen aria-hidden />
                        <span aria-hidden>{thread.journal_mentions}</span>
                        <span className="sr-only">{thread.journal_mentions} journal mentions</span>
                    </>
                )}
            </span>
        </li>
    );
};
