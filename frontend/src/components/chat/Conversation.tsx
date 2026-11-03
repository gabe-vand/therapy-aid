import { Link } from 'react-router-dom';
import { ChevronLeft, MessageSquare, Trash2 } from 'lucide-react';
import type { ChatMessage } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Loading, Skeleton } from '@/components/ui/Card';
import { Menu } from '@/components/ui/Menu';
import { EmptyState, ErrorState } from '@/components/ui/States';
import type { PendingMessage } from '@/services/hooks/use-chat';
import { paths } from '@/services/paths';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import './chat.css';
import './chat-conv.css';

/* The open conversation: a 48px header (back to the thread list on mobile, the title, an overflow
   menu with Delete), a scrolling message area and the composer pinned under it. Purely
   presentational — the Chat page owns the hooks and passes state down. An empty thread offers a
   few starter questions, which send exactly like typed ones. */

const STARTERS = ['What has David said about my racing mind?', 'What should I focus on this week?', 'What did we talk about in my last session?'];

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
                    <EmptyState
                        icon={<MessageSquare size={24} />}
                        title="Ask anything about your therapy"
                        body="Answers draw on your sessions, problems, focus and journal, with David's advice weighed first."
                        action={
                            <div className="flex flex-col gap-2">
                                {STARTERS.map((q) => (
                                    <Button key={q} size="sm" onClick={() => on_send(q)}>
                                        {q}
                                    </Button>
                                ))}
                            </div>
                        }
                    />
                ) : (
                    <MessageList messages={messages} pending={pending} on_retry={on_retry} on_discard={on_discard} />
                )}
            </div>
        </div>

        {!loading && error === null && <Composer on_send={on_send} disabled={pending !== null} />}
    </div>
);
