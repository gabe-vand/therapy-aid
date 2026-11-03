import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ChatThread } from '@therapy-aid/shared';
import { Conversation } from '@/components/chat/Conversation';
import { ThreadList } from '@/components/chat/ThreadList';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
import { useChat } from '@/services/hooks/use-chat';
import { useChatThreads } from '@/services/hooks/use-chat-threads';
import { paths } from '@/services/paths';
import '@/components/chat/chat.css';

/* Chat with the therapy material. /chat is the thread list; /chat/:id opens a conversation.
   Desktop shows both side by side; mobile shows one at a time (the conversation has a back
   link), so each gets the full width of a phone. This page only wires the two hooks to the
   presentational components and owns the delete confirmation. */
export default function Chat() {
    const { id } = useParams();
    const navigate = useNavigate();
    const parsed = id === undefined ? NaN : Number(id);
    const thread_id = Number.isInteger(parsed) ? parsed : null;

    const threads = useChatThreads();
    const chat = useChat(thread_id);
    const [to_delete, set_to_delete] = useState<ChatThread | null>(null);

    // An untouched "New chat" is reused rather than piling up another empty thread.
    const start_new = async () => {
        const empty = threads.threads.find((t) => t.message_count === 0);
        if (empty) return navigate(paths.chat_thread(empty.id));
        const created = await threads.create();
        if (created) navigate(paths.chat_thread(created.id));
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
                        on_new={start_new}
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
                        <EmptyState icon={<MessageSquare size={24} />} title="Pick a chat" body="Choose one from the list, or start a new chat." />
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
