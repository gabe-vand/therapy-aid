import { ChevronLeft, MessageSquareText, Sparkles, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import type { SaveState } from '@/services/hooks/use-journal-entry';
import './entry-bar.css';

/* The 48px row at the top of the journal's editor pane (sticky, journal-editor.css):
   [back to the list — phones only] [the entry's date, a quiet date input] … [save status]
   [a small pen that breathes while a margin note is being considered] [overflow menu: Reflect on
   this entry, Delete entry]. Presentation only: the entry editor owns the state. */

type Props = {
    date: string;
    on_date: (value: string) => void;
    save_state: SaveState;
    on_retry_save: () => void;
    thinking: boolean;
    can_reflect: boolean;
    reflecting: boolean;
    on_reflect: () => void;
    can_delete: boolean;
    on_delete: () => void;
    on_back: () => void;
};

const SAVE_LABEL: Record<SaveState, string> = { idle: '', saving: 'Saving…', saved: 'Saved', error: '' };

export function EntryToolbar({ date, on_date, save_state, on_retry_save, thinking, can_reflect, reflecting, on_reflect, can_delete, on_delete, on_back }: Props) {
    const items = [
        { label: reflecting ? 'Writing a reflection…' : 'Reflect on this entry', icon: <Sparkles aria-hidden />, on_select: on_reflect, disabled: !can_reflect || reflecting },
        ...(can_delete ? [{ label: 'Delete entry', tone: 'danger' as const, icon: <Trash2 aria-hidden />, on_select: on_delete }] : []),
    ];
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
            {thinking && (
                <span className="ta-entry-bar__thinking" role="status" aria-label="Considering a margin note">
                    <MessageSquareText aria-hidden />
                </span>
            )}
            <Menu label="Entry actions" items={items} />
        </div>
    );
}
