import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { NotebookPen, Plus } from 'lucide-react';
import type { JournalEntry } from '@therapy-aid/shared';
import { EntryEditor } from '@/components/journal/EntryEditor';
import { EntryList } from '@/components/journal/EntryList';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
import { useJournal } from '@/services/hooks/use-journal';
import { paths } from '@/services/paths';
import '@/components/journal/journal.css';

/* The journal, as a split-pane document editor (journal.css): on desktop the entry list is a 300px
   pane on the left and the open entry fills the rest, each pane scrolling on its own. On a phone
   only one shows at a time — the list, or the editor with a back control — and the window
   scrolls. `session` re-keys the editor whenever the writer picks an entry or starts a new one
   (or the URL moves to another entry); creating a draft does NOT change the key, so typing is
   never interrupted by the URL moving to the new entry. */
export default function Journal() {
    const { id } = useParams();
    const selected_id = id && /^\d+$/.test(id) ? Number(id) : null;
    const navigate = useNavigate();
    const [params] = useSearchParams();
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

    // /journal?new=1 (Home's "Write", the palette) opens a blank entry straight away.
    useEffect(() => {
        if (params.get('new') !== '1') return;
        set_composing(true);
        navigate(paths.journal, { replace: true });
    }, [params, navigate]);

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
        <Page width="full">
            <div className="ta-journal" data-view={show_editor ? 'editor' : 'list'}>
                <aside className="ta-journal__list">
                    <header className="ta-jlist__head">
                        <h1 className="ta-jlist__title">Journal</h1>
                        <Button variant="primary" className="ta-jlist__new" title="New entry" onClick={start_new}>
                            <Plus aria-hidden />
                            <span className="ta-jlist__new-label">New entry</span>
                        </Button>
                    </header>
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
                </aside>

                <section className="ta-journal__pane" aria-label="Entry" data-testid="journal-editor-pane">
                    {show_editor ? (
                        <EntryEditor key={editor_key} entry_id={selected_id} on_change={apply_entry} on_created={created} on_deleted={deleted} on_back={back} />
                    ) : (
                        <div className="ta-journal__idle">
                            <EmptyState
                                icon={<NotebookPen size={20} />}
                                title="Write today’s entry"
                                body="Or pick one on the left to read or edit. As you finish paragraphs, short margin notes appear when they connect to what you and David are working on."
                                action={
                                    <Button size="sm" onClick={start_new}>
                                        Start writing
                                    </Button>
                                }
                            />
                        </div>
                    )}
                </section>
            </div>
        </Page>
    );
}
