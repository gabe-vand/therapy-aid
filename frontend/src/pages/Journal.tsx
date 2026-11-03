import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { JournalEntry } from '@therapy-aid/shared';
import { EntryEditor } from '@/components/journal/EntryEditor';
import { EntryList } from '@/components/journal/EntryList';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/States';
import { useJournal } from '@/services/hooks/use-journal';
import { paths } from '@/services/paths';

/* The journal: entries on the left (stacked above the editor on a phone), the autosaving editor on
   the right. On a phone only one of the two shows at a time — the list, or the editor with a "←
   Entries" way back. `session` re-keys the editor whenever the writer picks an entry or starts a new
   one (or the URL moves to another entry); creating a draft does NOT change the key, so typing is
   never interrupted by the URL moving to the new entry. */
export default function Journal() {
    const { id } = useParams();
    const selected_id = id && /^\d+$/.test(id) ? Number(id) : null;
    const navigate = useNavigate();
    const { entries, loading, error, reload, apply_entry, drop_entry } = useJournal();
    const [composing, set_composing] = useState(false);
    const [session, set_session] = useState(0);
    const [created_id, set_created_id] = useState<number | null>(null);
    const show_editor = selected_id !== null || composing;
    const next_session = () => set_session((n) => n + 1);
    // The editor's key: stable while a draft turns into entry N (so typing continues), fresh otherwise.
    const editor_key = selected_id === null || selected_id === created_id ? `${session}:new` : `${session}:${selected_id}`;

    const start_new = () => {
        next_session();
        set_composing(true);
        if (selected_id !== null) navigate(paths.journal);
    };

    const back = () => {
        set_composing(false);
        navigate(paths.journal);
    };

    // The draft became a real entry: put its id in the URL (replace, so Back skips the blank draft).
    const created = (entry: JournalEntry) => {
        set_created_id(entry.id);
        navigate(paths.journal_entry(entry.id), { replace: true });
    };

    const deleted = (deleted_id: number) => {
        drop_entry(deleted_id);
        back();
    };

    return (
        <>
            <div className={show_editor ? 'hidden md:block' : undefined}>
                <PageHeader
                    title="Journal"
                    subtitle="Write freely. Ask for an idea when you want one."
                    actions={
                        <Button variant="primary" onClick={start_new}>
                            + New entry
                        </Button>
                    }
                />
            </div>

            <div className="grid gap-6 md:grid-cols-[250px_minmax(0,1fr)]">
                <div className={show_editor ? 'hidden md:block' : undefined}>
                    <EntryList
                        entries={entries}
                        loading={loading}
                        error={error}
                        selected_id={selected_id}
                        on_retry={reload}
                        on_select={() => {
                            next_session();
                            set_composing(false);
                        }}
                    />
                </div>

                <div className={show_editor ? undefined : 'hidden md:block'} data-testid="journal-editor-pane">
                    {show_editor ? (
                        <EntryEditor key={editor_key} entry_id={selected_id} on_change={apply_entry} on_created={created} on_deleted={deleted} on_back={back} />
                    ) : (
                        <div className="ta-card ta-muted px-6 py-12 text-center text-[15px]">Pick an entry to read or edit, or start a new one.</div>
                    )}
                </div>
            </div>
        </>
    );
}
