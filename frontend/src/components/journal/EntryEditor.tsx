import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { JournalEntry } from '@therapy-aid/shared';
import { Loading, Skeleton } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/States';
import { useInsights } from '@/services/hooks/use-insights';
import { useJournalEntry } from '@/services/hooks/use-journal-entry';
import { useMarginNotes } from '@/services/hooks/use-margin-notes';
import { useMarginNotesPref } from '@/services/hooks/use-margin-notes-pref';
import { EntryToolbar } from './EntryToolbar';
import { MarginColumn, MarginList, NotePill } from './MarginNotes';
import { useMarginView } from './use-margin-view';
import { ReflectionPanel } from './ReflectionPanel';
import { plain_length } from './entry-text';
import { RichEditor } from './RichEditor';
import './journal-editor.css';

/* The writing surface: the sticky entry toolbar (date, save status, menu), the rich-text document
   that saves itself, the margin notes beside or under it, the character count and the reflection
   panel. All data and saving come from hooks (entry, notes, margin notes); this component only
   wires them together. It is keyed by the page per "session" (user picks an entry / starts a new
   one) so its state resets cleanly — but NOT when a new draft is created, so typing is never
   interrupted. Margin notes watch the draft and arrive on their own (use-margin-notes); the
   reflection is on demand from the menu. */

type Props = { entry_id: number | null; on_change: (entry: JournalEntry) => void; on_created: (entry: JournalEntry) => void; on_deleted: (id: number) => void; on_back: () => void };

export function EntryEditor({ entry_id, on_change, on_created, on_deleted, on_back }: Props) {
    const entry = useJournalEntry(entry_id, { on_change, on_created });
    const notes = useInsights(entry.entry_id);
    const pref = useMarginNotesPref();
    const [confirm_delete, set_confirm_delete] = useState(false);
    const [doc, set_doc] = useState<HTMLElement | null>(null);
    const panel_ref = useRef<HTMLElement>(null);
    const chars = plain_length(entry.body);
    const margin = useMarginNotes(entry.entry_id, entry.body, entry.loaded_body, { enabled: pref.enabled && !entry.loading, on_note: notes.add });
    // Memoised: the margin view keys its measuring effect on this array's identity.
    const margin_notes = useMemo(() => notes.insights.filter((n) => n.source === 'margin'), [notes.insights]);
    const reflections = useMemo(() => notes.insights.filter((n) => n.source === 'reflection'), [notes.insights]);
    const margin_view = useMarginView(margin_notes, doc, notes.loaded);
    const dismiss = (id: number) => void notes.dismiss(id);

    // Bring the panel into view when a reflection starts — on a phone it sits below the keyboard area.
    useEffect(() => {
        if (notes.generating) panel_ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }, [notes.generating]);

    const on_editor = useCallback((editor: Editor | null) => set_doc(editor?.view.dom ?? null), []);

    const reflect = async () => {
        await notes.generate(entry.body);
    };

    const delete_entry = async () => {
        const id = entry.entry_id;
        if (id !== null && (await entry.remove())) on_deleted(id);
        set_confirm_delete(false);
    };

    if (entry.loading) {
        return (
            <div className="ta-entry__col ta-entry__col--pad">
                <Loading label="Loading entry">
                    <Skeleton height={28} className="mb-4 w-2/5" />
                    <Skeleton lines={6} />
                </Loading>
            </div>
        );
    }
    if (entry.error) {
        return (
            <div className="ta-entry__col ta-entry__col--pad">
                <ErrorState message={entry.error} on_retry={entry.retry} />
            </div>
        );
    }

    return (
        <div className="ta-entry" data-margin={margin_notes.length > 0 ? 'on' : 'off'}>
            <EntryToolbar
                date={entry.date}
                on_date={entry.set_date}
                save_state={entry.save_state}
                on_retry_save={() => void entry.save_now()}
                thinking={margin.thinking}
                can_reflect={entry.entry_id !== null && chars > 0}
                reflecting={notes.generating}
                on_reflect={() => void reflect()}
                can_delete={entry.entry_id !== null}
                on_delete={() => set_confirm_delete(true)}
                on_back={on_back}
            />
            {entry.save_state === 'error' && entry.save_error && <p className="ta-entry__save-error">{entry.save_error}</p>}

            <div className="ta-entry__body">
                <div className="ta-entry__doc">
                    <RichEditor value={entry.body} on_change={entry.set_body} label="Journal entry" placeholder="What's on your mind?" autofocus={entry_id === null} on_editor={on_editor} />
                    <div className="ta-entry__col ta-entry__foot">
                        <p className="ta-entry__count">{chars > 0 && `${chars} characters`}</p>
                        <MarginList view={margin_view} on_dismiss={dismiss} />
                        <ReflectionPanel
                            ref={panel_ref}
                            reflections={reflections}
                            generating={notes.generating}
                            generate_error={notes.generate_error}
                            history_error={notes.error ?? margin.error}
                            on_retry={() => void reflect()}
                            on_reload_history={() => void notes.reload()}
                        />
                    </div>
                </div>
                <MarginColumn view={margin_view} on_dismiss={dismiss} />
            </div>
            <NotePill view={margin_view} />

            <ConfirmDialog
                open={confirm_delete}
                title="Delete this entry?"
                body="The entry and its notes will be removed for good."
                confirm_label="Delete"
                busy={entry.deleting}
                on_confirm={() => void delete_entry()}
                on_cancel={() => set_confirm_delete(false)}
            />
        </div>
    );
}
