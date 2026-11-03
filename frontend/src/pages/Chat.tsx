import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ChatThread } from '@therapy-aid/shared';
import { ChatStarters } from '@/components/chat/ChatStarters';
import { Conversation } from '@/components/chat/Conversation';
import { ThreadList } from '@/components/chat/ThreadList';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
import { useChat } from '@/services/hooks/use-chat';
import { useChatThreads } from '@/services/hooks/use-chat-threads';
import { paths } from '@/services/paths';
import '@/components/chat/chat.css';

/* Chat with the therapy material. /chat is the thread list; /chat/:id opens a conversation.
   Desktop shows both side by side; mobile shows one at a time (the conversation has a back
   link), so each gets the full width of a phone. This page only wires the two hooks to the
   presentational components and owns the delete confirmation. With no thread open the pane shows
   the suggested questions; tapping one opens a thread (an untouched empty one is reused) and
   hands the question over in the navigation state, which is sent once that thread has loaded. */

type AskState = { ask?: string } | null;

export default function Chat() {
    const { id } = useParams();
    const navigate = useNavigate();
    const parsed = id === undefined ? NaN : Number(id);
    const thread_id = Number.isInteger(parsed) ? parsed : null;

    const threads = useChatThreads();
    const chat = useChat(thread_id);
    const [to_delete, set_to_delete] = useState<ChatThread | null>(null);
    const location = useLocation();
    const asked = useRef<string | null>(null);

    // An untouched "New chat" is reused rather than piling up another empty thread.
    const start_new = async (ask?: string) => {
        const state = ask ? { ask } : undefined;
        const empty = threads.threads.find((t) => t.message_count === 0);
        if (empty) return navigate(paths.chat_thread(empty.id), { state });
        const created = await threads.create();
        if (created) navigate(paths.chat_thread(created.id), { state });
    };

    const confirm_delete = async () => {
        if (!to_delete) return;
        const ok = await threads.remove(to_delete.id);
        set_to_delete(null);
        if (ok && to_delete.id === thread_id) navigate(paths.chat);
    };

    // A reply changes the thread's title (first message) and position, so re-read the list.
    const send = async (text: string) => {
        if (await chat.send(text)) void threads.refresh();
    };
    const retry = async () => {
        if (await chat.retry()) void threads.refresh();
    };

    // A question carried over from the empty pane: send it once the new thread has loaded, then
    // clear the state so a back/forward or a re-render can never send it twice.
    const ask = (location.state as AskState)?.ask;
    useEffect(() => {
        if (!ask || thread_id === null || chat.loading || chat.error !== null || asked.current === location.key) return;
        asked.current = location.key;
        navigate(location.pathname, { replace: true, state: null });
        void send(ask);
        // `send` is rebuilt every render and deliberately left out: the guards make this run once per question.
    }, [ask, thread_id, chat.loading, chat.error, location.key, location.pathname, navigate]);

    const open = thread_id !== null;
    const listed = threads.threads.find((t) => t.id === thread_id);
    const title = listed?.title ?? chat.thread?.title ?? 'Chat';

    return (
        <Page width="full">
            <div className="ta-chat" data-open={open}>
                <aside className="ta-chat-list">
                    <ThreadList
                        threads={threads.threads}
                        loading={threads.loading}
                        error={threads.error}
                        active_id={thread_id}
                        on_retry={threads.reload}
                        on_new={() => void start_new()}
                        creating={threads.creating}
                        on_delete={set_to_delete}
                        notice={threads.action_error && <ErrorState message={threads.action_error} />}
                    />
                </aside>

                <section aria-label="Conversation" className="ta-chat-pane">
                    {open ? (
                        <Conversation
                            title={title}
                            messages={chat.messages}
                            pending={chat.pending}
                            loading={chat.loading}
                            error={chat.error}
                            on_reload={chat.reload}
                            on_send={send}
                            on_retry={retry}
                            on_discard={chat.discard}
                            on_delete={() => set_to_delete(listed ?? chat.thread)}
                        />
                    ) : (
                        <div className="ta-conv__inner">
                            <ChatStarters on_ask={(q) => void start_new(q)} disabled={threads.creating} />
                        </div>
                    )}
                </section>
            </div>

            <ConfirmDialog
                open={to_delete !== null}
                title="Delete this chat?"
                body={to_delete ? `"${to_delete.title}" and its messages will be removed. This can't be undone.` : undefined}
                confirm_label="Delete chat"
                busy={threads.deleting}
                on_confirm={confirm_delete}
                on_cancel={() => set_to_delete(null)}
            />
        </Page>
    );
}
