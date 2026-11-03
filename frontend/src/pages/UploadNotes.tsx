import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, PageHeader } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
import { today_input } from '@/services/dates';
import { useNotesUpload } from '@/services/hooks/use-notes-upload';
import { paths } from '@/services/paths';
import '@/components/record/record.css';

/* Add a session from notes or a summary you already have (also how history gets seeded). Date
   defaults to today, title is optional (the summary names it if blank). Submitting saves the
   notes and lands on the session, which shows processing progress. The notes field reads at a
   14px/1.6 measure (16px on phones) with a live word and character count under it. */
export default function UploadNotes() {
    const navigate = useNavigate();
    const { submit, submitting, error } = useNotesUpload();
    const [date, set_date] = useState(() => today_input());
    const [title, set_title] = useState('');
    const [notes, set_notes] = useState('');

    const can_submit = notes.trim().length > 0 && date !== '' && !submitting;
    const words = notes.trim() === '' ? 0 : notes.trim().split(/\s+/).length;

    const on_submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!can_submit) return;
        const id = await submit({ date, title, notes });
        if (id !== null) navigate(paths.session(id));
    };

    return (
        <Page width="reading">
            <PageHeader back={{ to: paths.sessions, label: 'Sessions' }} title="Add notes" subtitle="Paste your own notes or a written summary of a session. It will be summarized the same way a recording is." />
            <Card>
                <form onSubmit={on_submit} className="ta-notes-form">
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                        Date of the session
                        <input className="ta-input md:max-w-56" type="date" value={date} max={today_input()} onChange={(e) => set_date(e.target.value)} required />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                        <span>
                            Title <span className="ta-muted font-normal">(optional)</span>
                        </span>
                        <input className="ta-input" value={title} onChange={(e) => set_title(e.target.value)} placeholder="Leave blank to let the summary name it" />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                        Notes
                        <textarea
                            className="ta-input ta-notes-field"
                            rows={14}
                            value={notes}
                            onChange={(e) => set_notes(e.target.value)}
                            placeholder="What did you and David talk about? Anything he suggested?"
                            aria-describedby="notes-count"
                            required
                        />
                    </label>
                    <p id="notes-count" className="ta-notes-count">
                        {words.toLocaleString('en-US')} {words === 1 ? 'word' : 'words'} · {notes.length.toLocaleString('en-US')} {notes.length === 1 ? 'character' : 'characters'}
                    </p>
                    {error && <ErrorState message={error} />}
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" variant="primary" disabled={!can_submit}>
                            {submitting ? 'Saving…' : 'Summarize these notes'}
                        </Button>
                        <Button variant="ghost" onClick={() => navigate(paths.sessions)} disabled={submitting}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </Card>
        </Page>
    );
}
