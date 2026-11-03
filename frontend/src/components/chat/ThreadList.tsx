import { Link } from 'react-router-dom';
import type { ChatThread } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Loading, Skeleton } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { relative_time } from '@/services/dates';
import { paths } from '@/services/paths';
import './chat.css';

/* The list of chats. On mobile it IS the /chat screen (opening a thread navigates to it); on
   desktop it sits beside the conversation with the open thread highlighted. Deleting only asks
   the page to confirm — the list never mutates anything itself. */

type Props = { threads: ChatThread[]; loading: boolean; error: string | null; active_id: number | null; on_retry: () => void; on_new: () => void; creating: boolean; on_delete: (thread: ChatThread) => void };

const meta = (t: ChatThread) => `${t.message_count} ${t.message_count === 1 ? 'message' : 'messages'} · ${relative_time(t.updated_at)}`;

export const ThreadList = ({ threads, loading, error, active_id, on_retry, on_new, creating, on_delete }: Props) => {
    if (loading) {
        return (
            <Loading label="Loading chats…">
                <div className="flex flex-col gap-2">
                    <Skeleton height={58} />
                    <Skeleton height={58} />
                    <Skeleton height={58} />
                </div>
            </Loading>
        );
    }
    if (error !== null) return <ErrorState message={error} on_retry={on_retry} />;

    return (
        <nav aria-label="Chats" className="flex flex-col gap-2">
            <Button variant="primary" onClick={on_new} disabled={creating}>
                {creating ? 'Starting…' : 'New chat'}
            </Button>
            {threads.length === 0 ? (
                <EmptyState title="No chats yet" body="Start one to ask about what you and David have covered." />
            ) : (
                <ul className="mt-1 flex flex-col gap-2">
                    {threads.map((t) => (
                        <li key={t.id} className="ta-thread" data-active={t.id === active_id}>
                            <Link to={paths.chat_thread(t.id)} className="ta-thread-link" aria-current={t.id === active_id ? 'page' : undefined}>
                                <span className="block truncate font-medium">{t.title}</span>
                                <span className="ta-muted block text-[13px]">{meta(t)}</span>
                            </Link>
                            <Button variant="ghost" size="sm" className="self-center" aria-label={`Delete chat ${t.title}`} onClick={() => on_delete(t)}>
                                Delete
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </nav>
    );
};
