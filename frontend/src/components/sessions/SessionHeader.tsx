import { useState, type FormEvent } from 'react';
import type { Session } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { format_date, from_date_input, to_date_input } from '@/services/dates';
import { SOURCE_LABEL, StatusChip } from './StatusChip';

/* The session's title row: the title as the page's <h1>, the date and source under it, and an Edit
   button that swaps in a small form for the two things you can correct — the title and the day
   (a recording is stamped "now", but you may be filing last Tuesday's). */

type Props = { session: Session; saving: boolean; on_save: (patch: { occurred_at?: string; title?: string }) => Promise<boolean> };

const minutes = (sec: number) => `${Math.max(1, Math.round(sec / 60))} min`;

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
            <form onSubmit={submit} className="mb-6 flex flex-col gap-3" aria-label="Edit session">
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
        <header className="mb-6">
            <div className="flex items-start justify-between gap-3">
                <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:text-3xl">{shown_title}</h1>
                <Button size="sm" variant="ghost" onClick={begin_edit} aria-label="Edit title and date">
                    Edit
                </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="ta-muted text-[15px]">{format_date(session.occurred_at, { weekday: true })}</span>
                <span className="ta-muted text-[15px]">
                    {SOURCE_LABEL[session.source]}
                    {session.duration_sec ? ` · ${minutes(session.duration_sec)}` : ''}
                </span>
                <StatusChip status={session.status} />
            </div>
        </header>
    );
};
