import { Link } from 'react-router-dom';
import type { JournalEntry } from '@therapy-aid/shared';
import { Loading, Skeleton } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { format_date } from '@/services/dates';
import { paths } from '@/services/paths';
import { first_line } from './idea-rules';
import './journal.css';

/* The journal's entry list, newest first: date over the first line of each entry, the open one
   highlighted, a small 💡 count where insights exist. Loading / empty / error are handled here so
   the page only decides where the list sits. */

type Props = {
    entries: JournalEntry[];
    loading: boolean;
    error: string | null;
    selected_id: number | null;
    on_retry: () => void;
    on_select: () => void; // called when the writer picks an entry (the page remounts the editor)
};

export function EntryList({ entries, loading, error, selected_id, on_retry, on_select }: Props) {
    if (loading) {
        return (
            <Loading label="Loading entries">
                <div className="flex flex-col gap-2">
                    <Skeleton height={56} />
                    <Skeleton height={56} />
                    <Skeleton height={56} />
                </div>
            </Loading>
        );
    }
    if (error) return <ErrorState message={error} on_retry={on_retry} />;
    if (entries.length === 0) return <EmptyState title="No entries yet" body="Start writing. Entries save themselves as you type." />;

    return (
        <nav aria-label="Journal entries" className="ta-card overflow-hidden">
            {entries.map((e) => (
                <Link key={e.id} to={paths.journal_entry(e.id)} className="ta-journal-row" aria-current={e.id === selected_id ? 'page' : undefined} onClick={on_select}>
                    <span className="ta-muted flex items-center justify-between text-[12px] font-medium">
                        <span>{format_date(e.occurred_at, { weekday: true })}</span>
                        {e.insight_count > 0 && <span aria-label={`${e.insight_count} ideas`}>💡 {e.insight_count}</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-[15px] font-medium">{first_line(e.body)}</span>
                </Link>
            ))}
        </nav>
    );
}
