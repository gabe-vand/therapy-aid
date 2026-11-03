import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatThread } from '@therapy-aid/shared';
import { getAPI, isOk, postAPI } from '@/services/api';

/* One conversation: loads GET /chat/threads/:id and sends messages. Sending is optimistic —
   the user's text shows at once as `pending` (a "thinking" state while the request is in
   flight, an error with a retry if it failed) and is replaced by the two stored messages the
   server returns. There is no streaming: the reply arrives whole, which can take a while. */

interface Conversation {
    thread: ChatThread;
    messages: ChatMessage[];
}

interface SendResult {
    user: ChatMessage;
    assistant: ChatMessage;
}

export interface PendingMessage {
    content: string;
    // null while the request is in flight; the readable reason once it has failed.
    error: string | null;
}

export const useChat = (thread_id: number | null) => {
    const [thread, set_thread] = useState<ChatThread | null>(null);
    const [messages, set_messages] = useState<ChatMessage[]>([]);
    const [error, set_error] = useState<string | null>(null);
    const [pending, set_pending] = useState<PendingMessage | null>(null);
    // The thread the state above belongs to (null while a load is running). Comparing it with the
    // requested id makes `loading` correct on the very render a new thread opens — without it, the
    // previous (or empty) state would flash as if it were the new thread's.
    const [owner, set_owner] = useState<number | null>(null);

    // The thread a response belongs to must still be the open one when it lands.
    const open_thread = useRef(thread_id);
    const in_flight = useRef(false);

    const load = useCallback(
        async (signal: { cancelled: boolean }) => {
            if (thread_id === null) return;
            set_owner(null);
            const res = await getAPI<Conversation>(`chat/threads/${thread_id}`);
            if (signal.cancelled) return;
            if (isOk(res)) {
                set_thread(res.data.thread);
                set_messages(res.data.messages);
                set_error(null);
            } else {
                set_error(res.message);
            }
            set_owner(thread_id);
        },
        [thread_id],
    );

    // Opening another thread starts clean: nothing from the previous one may leak across.
    useEffect(() => {
        open_thread.current = thread_id;
        in_flight.current = false;
        set_thread(null);
        set_messages([]);
        set_pending(null);
        set_error(null);
        const signal = { cancelled: false };
        void load(signal);
        return () => {
            signal.cancelled = true;
        };
    }, [thread_id, load]);

    const reload = useCallback(() => load({ cancelled: false }), [load]);

    /* Resolves true when the assistant answered. A second send while one is in flight is ignored. */
    const send = useCallback(
        async (content: string): Promise<boolean> => {
            const text = content.trim();
            if (thread_id === null || text === '' || in_flight.current) return false;
            in_flight.current = true;
            set_pending({ content: text, error: null });
            const res = await postAPI<SendResult>(`chat/threads/${thread_id}/messages`, { content: text });
            if (open_thread.current !== thread_id) return false;
            in_flight.current = false;
            if (isOk(res)) {
                const stored = [res.data.user, res.data.assistant];
                set_messages((prev) => [...prev.filter((m) => !stored.some((s) => s.id === m.id)), ...stored]);
                set_pending(null);
                return true;
            }
            set_pending({ content: text, error: res.message });
            return false;
        },
        [thread_id],
    );

    /* Re-sends exactly what failed. */
    const retry = useCallback(() => (pending?.error ? send(pending.content) : Promise.resolve(false)), [pending, send]);

    /* Drops a failed message instead of retrying it. */
    const discard = useCallback(() => set_pending((p) => (p?.error ? null : p)), []);

    const current = thread_id !== null && owner === thread_id;
    const shown_pending = current ? pending : null;

    return {
        thread: current ? thread : null,
        messages: current ? messages : [],
        loading: thread_id !== null && !current,
        error: current ? error : null,
        reload,
        pending: shown_pending,
        sending: shown_pending !== null && shown_pending.error === null,
        send,
        retry,
        discard,
    };
};
