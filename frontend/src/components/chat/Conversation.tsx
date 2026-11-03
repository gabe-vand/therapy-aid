import { Link } from 'react-router-dom';
import { ChevronLeft, Trash2 } from 'lucide-react';
import type { ChatMessage } from '@therapy-aid/shared';
import { Loading, Skeleton } from '@/components/ui/Card';
import { Menu } from '@/components/ui/Menu';
import { ErrorState } from '@/components/ui/States';
import type { PendingMessage } from '@/services/hooks/use-chat';
import { paths } from '@/services/paths';
import { ChatStarters } from './ChatStarters';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import './chat.css';
import './chat-conv.css';

/* The open conversation: a 48px header (back to the thread list on mobile, the title, an overflow
   menu with Delete), a scrolling message area and the composer pinned under it. Purely
   presentational — the Chat page owns the hooks and passes state down. An empty thread shows
   ChatStarters, whose suggested questions send exactly like typed ones. */

type Props = {
    title: string;
    messages: ChatMessage[];
    pending: PendingMessage | null;
    loading: boolean;
    error: string | null;
    on_reload: () => void;
    on_send: (text: string) => void;
    on_retry: () => void;
    on_discard: () => void;
    on_delete: () => void;
};

export const Conversation = ({ title, messages, pending, loading, error, on_reload, on_send, on_retry, on_discard, on_delete }: Props) => (
    <div className="ta-conv">
        <div className="ta-conv__head">
            <Link to={paths.chat} className="ta-btn ta-btn--ghost ta-icon-btn md:hidden" aria-label="Chats" title="Chats">
                <ChevronLeft aria-hidden />
            </Link>
            <h2 className="ta-conv__title">{title}</h2>
            <Menu label="Chat actions" items={[{ label: 'Delete chat', tone: 'danger', icon: <Trash2 aria-hidden />, on_select: on_delete, disabled: loading && error === null }]} />
        </div>

        <div className="ta-conv__scroll">
            <div className="ta-conv__inner">
                {loading ? (
                    <Loading label="Loading conversation…">
                        <Skeleton lines={4} height={18} />
                    </Loading>
                ) : error !== null ? (
                    <ErrorState message={error} on_retry={on_reload} />
                ) : messages.length === 0 && pending === null ? (
                    <ChatStarters on_ask={on_send} />
                ) : (
                    <MessageList messages={messages} pending={pending} on_retry={on_retry} on_discard={on_discard} />
                )}
            </div>
        </div>

        {!loading && error === null && <Composer on_send={on_send} disabled={pending !== null} />}
    </div>
);
