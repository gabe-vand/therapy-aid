import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import type { ChatThread } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Loading, Skeleton } from '@/components/ui/Card';
import { Menu } from '@/components/ui/Menu';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { relative_time } from '@/services/dates';
import { paths } from '@/services/paths';
import './chat.css';

/* The list of chats. On mobile it IS the /chat screen (opening a thread navigates to it); on
   desktop it sits beside the conversation with the open thread highlighted. A row is the title
   with when it was last touched on the right, and a small message count under it. Each row has an
   overflow menu (hover-revealed on desktop, always there on touch) whose "Delete chat" only asks
   the page to confirm — the list never mutates anything itself. `notice` renders under the header
   (the page's delete-failure alert). */

type Props = { threads: ChatThread[]; loading: boolean; error: string | null; active_id: number | null; on_retry: () => void; on_new: () => void; creating: boolean; on_delete: (thread: ChatThread) => void; notice?: ReactNode };

const count = (t: ChatThread) => `${t.message_count} ${t.message_count === 1 ? 'message' : 'messages'}`;

const Body = ({ threads, loading, error, active_id, on_retry, on_delete }: Props) => {
    if (loading) {
        return (
            <Loading label="Loading chats…">
                <div className="ta-chat-list__body">
                    <Skeleton height={44} />
                    <Skeleton height={44} />
                    <Skeleton height={44} />
                </div>
            </Loading>
        );
    }
    if (error !== null) {
        return (
            <div className="ta-chat-list__notice">
                <ErrorState message={error} on_retry={on_retry} />
            </div>
        );
    }
    if (threads.length === 0) return <EmptyState title="No chats yet" body="Start one to ask about what you and David have covered." />;
    return (
        <ul className="ta-chat-list__body">
            {threads.map((t) => (
                <li key={t.id} className="ta-thread" data-active={t.id === active_id}>
                    <Link to={paths.chat_thread(t.id)} className="ta-thread-link" aria-current={t.id === active_id ? 'page' : undefined}>
                        <span className="ta-thread-link__top">
                            <span className="ta-thread-link__title">{t.title}</span>
                        </span>
                        <span className="ta-thread-link__meta">
                            {count(t)}
                            {' · '}
                            <time className="ta-thread-link__time" dateTime={t.updated_at}>
                                {relative_time(t.updated_at)}
                            </time>
                        </span>
                    </Link>
                    <Menu label={`Chat actions: ${t.title}`} size="sm" items={[{ label: 'Delete chat', tone: 'danger', icon: <Trash2 aria-hidden />, on_select: () => on_delete(t) }]} />
                </li>
            ))}
        </ul>
    );
};

export const ThreadList = (props: Props) => (
    <nav aria-label="Chats">
        <div className="ta-chat-list__head">
            <h2 className="ta-chat-list__title">Chats</h2>
            <Button size="sm" variant="primary" onClick={props.on_new} disabled={props.creating}>
                <Plus aria-hidden />
                New chat
            </Button>
        </div>
        {props.notice && <div className="ta-chat-list__notice">{props.notice}</div>}
        <Body {...props} />
    </nav>
);
