import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { JournalMention } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { format_date } from '@/services/dates';
import { paths } from '@/services/paths';
import './problems-timeline.css';

/* "In your journal": the paragraphs the margin-note classifier tied to this problem, newest first —
   the entry's date (a link to the entry) over the excerpt on a quiet left rule. Six show at first;
   "Show all" opens the rest. Nothing renders when the journal never mentioned it. */

export const MENTIONS_SHOWN = 6;

export function JournalMentions({ mentions }: { mentions: JournalMention[] }) {
    const [all, set_all] = useState(false);
    if (mentions.length === 0) return null;
    const sorted = [...mentions].sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0));
    const shown = all ? sorted : sorted.slice(0, MENTIONS_SHOWN);
    return (
        <section aria-labelledby="journal-mentions-title" className="ta-pdetail__section">
            <h2 id="journal-mentions-title" className="ta-section-label">
                In your journal
            </h2>
            <ul className="ta-jm" aria-label="Journal mentions">
                {shown.map((m, i) => (
                    <li key={`${m.entry_id}-${i}`} className="ta-jm__item">
                        <Link to={paths.journal_entry(m.entry_id)} className="ta-jm__date">
                            {format_date(m.occurred_at, { weekday: true })}
                        </Link>
                        <p className="ta-jm__quote">{m.excerpt}</p>
                    </li>
                ))}
            </ul>
            {!all && sorted.length > MENTIONS_SHOWN && (
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => set_all(true)}>
                    Show all {sorted.length}
                </Button>
            )}
        </section>
    );
}
