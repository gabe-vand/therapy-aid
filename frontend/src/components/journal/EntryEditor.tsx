import { useEffect, useRef, useState } from 'react';
import type { JournalEntry } from '@therapy-aid/shared';
import { Loading, Skeleton } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/States';
import { useInsights } from '@/services/hooks/use-insights';
import { useJournalEntry } from '@/services/hooks/use-journal-entry';
import { EntryToolbar } from './EntryToolbar';
import { IdeaButton } from './IdeaButton';
import { InsightPanel } from './InsightPanel';
import { plain_length } from './idea-rules';
import { RichEditor } from './RichEditor';
import './journal-editor.css';

/* The writing surface: the sticky entry toolbar (date, save status, idea button, delete), the
   rich-text document that saves itself, the character count and the insight panel. All data and
   saving come from hooks (entry + insights); this component only wires them together. It is keyed
   by the page per "session" (user picks an entry / starts a new one) so its state resets cleanly —
   but NOT when a new draft is created, so typing is never interrupted. The idea baseline is the
   draft length when opened or at the last insight. */

type Props = { entry_id: number | null; on_change: (entry: JournalEntry) => void; on_created: (entry: JournalEntry) => void; on_deleted: (id: number) => void; on_back: () => void };

export function EntryEditor({ entry_id, on_change, on_created, on_deleted, on_back }: Props) {
    const entry = useJournalEntry(entry_id, { on_change, on_created });
    const insights = useInsights(entry.entry_id);
    const [baseline_override, set_baseline] = useState<number | null>(null);
    const [confirm_delete, set_confirm_delete] = useState(false);
    const panel_ref = useRef<HTMLElement>(null);
    const baseline = baseline_override ?? entry.loaded_length;
    const chars = plain_length(entry.body);

    // Bring the panel into view when generation starts — on a phone it sits below the keyboard area.
    useEffect(() => {
        if (insights.generating) panel_ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }, [insights.generating]);

    const generate = async () => {
        const draft = entry.body;
        if (await insights.generate(draft)) set_baseline(draft.length);
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
        <div className="ta-entry">
            <EntryToolbar
                date={entry.date}
                on_date={entry.set_date}
                save_state={entry.save_state}
                on_retry_save={() => void entry.save_now()}
                idea={<IdeaButton draft={entry.body} baseline={baseline} busy={insights.generating} disabled={entry.entry_id === null} on_click={() => void generate()} />}
                can_delete={entry.entry_id !== null}
                on_delete={() => set_confirm_delete(true)}
                on_back={on_back}
            />
            {entry.save_state === 'error' && entry.save_error && <p className="ta-entry__save-error">{entry.save_error}</p>}

            <RichEditor value={entry.body} on_change={entry.set_body} label="Journal entry" placeholder="What's on your mind?" autofocus={entry_id === null} />

            <div className="ta-entry__col ta-entry__foot">
                <p className="ta-entry__count">{chars > 0 && `${chars} characters`}</p>
                <InsightPanel
                    ref={panel_ref}
                    insights={insights.insights}
                    generating={insights.generating}
                    generate_error={insights.generate_error}
                    history_error={insights.error}
                    on_retry={() => void generate()}
                    on_reload_history={() => void insights.reload()}
                />
            </div>

            <ConfirmDialog
                open={confirm_delete}
                title="Delete this entry?"
                body="The entry and its ideas will be removed for good."
                confirm_label="Delete"
                busy={entry.deleting}
                on_confirm={() => void delete_entry()}
                on_cancel={() => set_confirm_delete(false)}
            />
        </div>
    );
}
