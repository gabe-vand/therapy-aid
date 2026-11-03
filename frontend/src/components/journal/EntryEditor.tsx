import { useEffect, useRef, useState } from 'react';
import type { JournalEntry } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Card, Loading, Skeleton } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/States';
import { useInsights } from '@/services/hooks/use-insights';
import { useJournalEntry, type SaveState } from '@/services/hooks/use-journal-entry';
import { IdeaButton } from './IdeaButton';
import { InsightPanel } from './InsightPanel';
import './journal.css';

/* The writing surface: a date, a textarea that saves itself, the save indicator, the idea button
   and the insight panel. All data and saving come from hooks (entry + insights); this component
   only wires them together. It is keyed by the page per "session" (user picks an entry / starts a
   new one) so its state resets cleanly — but NOT when a new draft is created, so typing is never
   interrupted. The idea baseline is the draft length when opened or at the last insight. */

type Props = { entry_id: number | null; on_change: (entry: JournalEntry) => void; on_created: (entry: JournalEntry) => void; on_deleted: (id: number) => void; on_back: () => void };

const SAVE_LABEL: Record<SaveState, string> = { idle: '', saving: 'Saving…', saved: 'Saved', error: '' };

export function EntryEditor({ entry_id, on_change, on_created, on_deleted, on_back }: Props) {
    const entry = useJournalEntry(entry_id, { on_change, on_created });
    const insights = useInsights(entry.entry_id);
    const [baseline_override, set_baseline] = useState<number | null>(null);
    const [confirm_delete, set_confirm_delete] = useState(false);
    const panel_ref = useRef<HTMLElement>(null);
    const baseline = baseline_override ?? entry.loaded_length;

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
            <Loading label="Loading entry">
                <Skeleton height={44} className="mb-3" />
                <Skeleton height={240} />
            </Loading>
        );
    }
    if (entry.error) return <ErrorState message={entry.error} on_retry={entry.retry} />;

    return (
        <>
            <Card as="div" padded={false} className="p-4 md:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" className="md:hidden" onClick={on_back}>
                        ← Entries
                    </Button>
                    <input type="date" className="ta-input" style={{ width: 'auto' }} aria-label="Entry date" value={entry.date} onChange={(e) => entry.set_date(e.target.value)} />
                    <span className="ta-muted ml-auto text-[13px]" role="status" aria-live="polite">
                        {entry.save_state === 'error' ? (
                            <span style={{ color: 'var(--danger)' }}>
                                Couldn&apos;t save.{' '}
                                <button type="button" className="font-semibold underline" onClick={() => void entry.save_now()}>
                                    Retry
                                </button>
                            </span>
                        ) : (
                            SAVE_LABEL[entry.save_state]
                        )}
                    </span>
                    {entry.entry_id !== null && (
                        <Button variant="ghost" size="sm" onClick={() => set_confirm_delete(true)}>
                            Delete
                        </Button>
                    )}
                </div>
                {entry.save_state === 'error' && entry.save_error && (
                    <p className="mb-3 text-[13px]" style={{ color: 'var(--danger)' }}>
                        {entry.save_error}
                    </p>
                )}

                <textarea className="ta-input ta-journal-text" aria-label="Journal entry" placeholder="What's on your mind?" value={entry.body} onChange={(e) => entry.set_body(e.target.value)} autoFocus={entry_id === null} />

                <div className="mt-3 flex min-h-10 flex-wrap items-center justify-between gap-2">
                    <IdeaButton draft={entry.body} baseline={baseline} busy={insights.generating} disabled={entry.entry_id === null} on_click={() => void generate()} />
                    <span className="ta-muted ml-auto text-[12px]">{entry.body.length > 0 && `${entry.body.length} characters`}</span>
                </div>
            </Card>

            <InsightPanel
                ref={panel_ref}
                insights={insights.insights}
                generating={insights.generating}
                generate_error={insights.generate_error}
                history_error={insights.error}
                on_retry={() => void generate()}
                on_reload_history={() => void insights.reload()}
            />

            <ConfirmDialog
                open={confirm_delete}
                title="Delete this entry?"
                body="The entry and its ideas will be removed for good."
                confirm_label="Delete"
                busy={entry.deleting}
                on_confirm={() => void delete_entry()}
                on_cancel={() => set_confirm_delete(false)}
            />
        </>
    );
}
