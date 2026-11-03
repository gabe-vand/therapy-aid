import { Link } from 'react-router-dom';
import { CircleHelp, Link2, Quote, X } from 'lucide-react';
import type { JournalInsight, JournalNoteKind } from '@therapy-aid/shared';
import { Markdown } from '@/components/markdown/Markdown';
import { IconButton } from '@/components/ui/Button';
import { format_date } from '@/services/dates';
import { paths } from '@/services/paths';
import './margin-note.css';

/* One margin note: a 2px accent rule, a kind line (what David suggested / a connection / a
   question, with the session date when one was drawn on), the note itself, and the problem it
   belongs to as a link. `quote` (the paragraph's opening words) is shown only in the inline
   layout, where the card cannot sit beside its paragraph. Dismiss hides it for good. */

const KIND: Record<JournalNoteKind, { label: string; Icon: typeof Quote }> = {
    advice: { label: 'What David suggested', Icon: Quote },
    connection: { label: 'A connection', Icon: Link2 },
    question: { label: 'A question for you', Icon: CircleHelp },
    reflection: { label: 'Reflection', Icon: Quote },
};

type Props = { note: JournalInsight; quote?: string | null; fresh?: boolean; on_dismiss: (id: number) => void };

export function MarginNote({ note, quote = null, fresh = false, on_dismiss }: Props) {
    const { label, Icon } = KIND[note.kind];
    return (
        <article className={`ta-note ta-note--${note.kind}${fresh ? ' ta-note--fresh' : ''}`} aria-label={`Margin note: ${label}`} data-note-id={note.id}>
            <header className="ta-note__head">
                <Icon aria-hidden />
                <span className="ta-note__kind">{label}</span>
                {note.session_id !== null && (
                    <Link to={paths.session(note.session_id)} className="ta-note__when">
                        session
                    </Link>
                )}
                <IconButton aria-label="Dismiss note" size="sm" className="ta-note__dismiss" onClick={() => on_dismiss(note.id)}>
                    <X aria-hidden />
                </IconButton>
            </header>
            {quote && <p className="ta-note__quote">“{quote}…”</p>}
            <Markdown text={note.body} className="ta-note__body" />
            <footer className="ta-note__foot">
                {note.problem_id !== null && note.problem_title && (
                    <Link to={paths.problem(note.problem_id)} className="ta-note__problem">
                        {note.problem_title}
                    </Link>
                )}
                <time className="ta-note__stamp" dateTime={note.created_at}>
                    {format_date(note.created_at, { year: false })}
                </time>
            </footer>
        </article>
    );
}
