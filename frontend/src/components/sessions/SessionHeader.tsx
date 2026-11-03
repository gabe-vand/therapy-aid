import { useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import type { Session } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { format_date, from_date_input, to_date_input } from '@/services/dates';
import { SOURCE_LABEL, StatusChip } from './StatusChip';
import './session-header.css';

/* The session's title row: the title as the page's <h1> (24px), one meta line under it ("Fri, Oct 23
   · Notes · 48 min") with the status chip, and an Edit button that swaps in a small form for the two things you can correct — the title and the day
   (a recording is stamped "now", but you may be filing last Tuesday's). */

type Props = { session: Session; saving: boolean; on_save: (patch: { occurred_at?: string; title?: string }) => Promise<boolean> };

const minutes = (sec: number) => `${Math.max(1, Math.round(sec / 60))} min`;

/* "Fri, Oct 23 · Notes · 48 min" — the year only when it is not this year. */
export const date_line = (session: Pick<Session, 'occurred_at' | 'source' | 'duration_sec'>, now: Date = new Date()): string => {
    const this_year = new Date(session.occurred_at).getFullYear() === now.getFullYear();
    const parts = [format_date(session.occurred_at, { weekday: true, year: !this_year }), SOURCE_LABEL[session.source]];
    if (session.duration_sec) parts.push(minutes(session.duration_sec));
    return parts.join(' · ');
};

export const SessionHeader = ({ session, saving, on_save }: Props) => {
    const [editing, set_editing] = useState(false);
    const [title, set_title] = useState('');
    const [date, set_date] = useState('');

    const shown_title = session.title ?? session.summary?.title ?? `Session on ${format_date(session.occurred_at)}`;

    const begin_edit = () => {
        set_title(session.title ?? session.summary?.title ?? '');
        set_date(to_date_input(session.occurred_at));
        set_editing(true);
    };

    // Only send what changed, so a title-only edit never rewrites the date.
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const patch: { occurred_at?: string; title?: string } = {};
        const next_date = from_date_input(date);
        if (next_date && date !== to_date_input(session.occurred_at)) patch.occurred_at = next_date;
        if (title.trim() && title.trim() !== session.title) patch.title = title.trim();
        if (Object.keys(patch).length === 0 || (await on_save(patch))) set_editing(false);
    };

    if (editing) {
        return (
            <form onSubmit={submit} className="ta-shead ta-shead--form" aria-label="Edit session">
                <label className="flex flex-col gap-1 text-sm font-medium">
                    Title
                    <input className="ta-input" value={title} onChange={(e) => set_title(e.target.value)} placeholder="Untitled session" />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                    Date
                    <input className="ta-input" type="date" value={date} onChange={(e) => set_date(e.target.value)} required />
                </label>
                <div className="flex gap-2">
                    <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button variant="ghost" onClick={() => set_editing(false)} disabled={saving}>
                        Cancel
                    </Button>
                </div>
            </form>
        );
    }

    return (
        <header className="ta-shead">
            <div className="ta-shead__row">
                <h1 className="ta-shead__title">{shown_title}</h1>
                <Button size="sm" variant="ghost" onClick={begin_edit} aria-label="Edit title and date">
                    <Pencil aria-hidden />
                    Edit
                </Button>
            </div>
            <div className="ta-shead__meta">
                <span>{date_line(session)}</span>
                <StatusChip status={session.status} />
            </div>
        </header>
    );
};
