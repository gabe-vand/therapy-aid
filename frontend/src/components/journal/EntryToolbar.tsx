import type { ReactNode } from 'react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import type { SaveState } from '@/services/hooks/use-journal-entry';

/* The 48px row at the top of the journal's editor pane (sticky, journal-editor.css):
   [back to the list — phones only] [the entry's date, a quiet date input] … [save status]
   [the idea button, passed in] [overflow menu with Delete entry]. Presentation only: the
   entry editor owns the state and hands over values and callbacks. */

type Props = { date: string; on_date: (value: string) => void; save_state: SaveState; on_retry_save: () => void; idea: ReactNode; can_delete: boolean; on_delete: () => void; on_back: () => void };

const SAVE_LABEL: Record<SaveState, string> = { idle: '', saving: 'Saving…', saved: 'Saved', error: '' };

export function EntryToolbar({ date, on_date, save_state, on_retry_save, idea, can_delete, on_delete, on_back }: Props) {
    return (
        <div className="ta-entry-bar">
            <IconButton aria-label="Entries" className="ta-entry-bar__back" onClick={on_back}>
                <ChevronLeft aria-hidden />
            </IconButton>
            <input type="date" className="ta-date-quiet" aria-label="Entry date" value={date} onChange={(e) => on_date(e.target.value)} />
            <span className="ta-entry-bar__status" role="status" aria-live="polite">
                {save_state === 'error' ? (
                    <span className="ta-entry-bar__error">
                        Couldn&apos;t save.{' '}
                        <button type="button" className="ta-entry-bar__retry" onClick={on_retry_save}>
                            Retry
                        </button>
                    </span>
                ) : (
                    SAVE_LABEL[save_state]
                )}
            </span>
            {idea}
            {can_delete && <Menu label="Entry actions" items={[{ label: 'Delete entry', tone: 'danger', icon: <Trash2 aria-hidden />, on_select: on_delete }]} />}
        </div>
    );
}
