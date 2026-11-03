import { Link } from 'react-router-dom';
import { MessageSquareText } from 'lucide-react';
import type { JournalEntry } from '@therapy-aid/shared';
import { Loading, Skeleton } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { format_date, format_month } from '@/services/dates';
import { paths } from '@/services/paths';
import { first_line } from './entry-text';
import './journal.css';

/* The journal's entry list, newest first, grouped under sticky month labels ("October 2026"):
   each row is the day over the entry's first line (Markdown stripped), the open one highlighted,
   and a small count where notes exist. Loading / empty / error are handled here so
   the page only decides where the list sits. */

type Props = {
    entries: JournalEntry[];
    loading: boolean;
    error: string | null;
    selected_id: number | null;
    on_retry: () => void;
    on_select: () => void; // called when the writer picks an entry (the page remounts the editor)
};

type Group = { label: string; entries: JournalEntry[] };

const by_month = (entries: JournalEntry[]): Group[] =>
    entries.reduce<Group[]>((groups, e) => {
        const label = format_month(e.occurred_at);
        const last = groups[groups.length - 1];
        if (last?.label === label) last.entries.push(e);
        else groups.push({ label, entries: [e] });
        return groups;
    }, []);

export function EntryList({ entries, loading, error, selected_id, on_retry, on_select }: Props) {
    if (loading) {
        return (
            <Loading label="Loading entries">
                <div className="flex flex-col gap-2 p-3">
                    <Skeleton height={48} />
                    <Skeleton height={48} />
                    <Skeleton height={48} />
                </div>
            </Loading>
        );
    }
    if (error) {
        return (
            <div className="p-3">
                <ErrorState message={error} on_retry={on_retry} />
            </div>
        );
    }
    if (entries.length === 0) return <EmptyState title="No entries yet" body="Start writing. Entries save themselves as you type." />;

    return (
        <nav aria-label="Journal entries" className="ta-jlist">
            {by_month(entries).map((group) => (
                <section key={group.label} aria-label={group.label}>
                    <h2 className="ta-jlist__month">{group.label}</h2>
                    {group.entries.map((e) => (
                        <Link key={e.id} to={paths.journal_entry(e.id)} className="ta-jrow" aria-current={e.id === selected_id ? 'page' : undefined} onClick={on_select}>
                            <span className="ta-jrow__top">
                                <span className="ta-jrow__date">{format_date(e.occurred_at, { weekday: true, year: false })}</span>
                                {e.insight_count > 0 && (
                                    <span className="ta-jrow__ideas" aria-label={`${e.insight_count} notes`}>
                                        <MessageSquareText aria-hidden />
                                        {e.insight_count}
                                    </span>
                                )}
                            </span>
                            <span className="ta-jrow__preview">{first_line(e.body)}</span>
                        </Link>
                    ))}
                </section>
            ))}
        </nav>
    );
}
