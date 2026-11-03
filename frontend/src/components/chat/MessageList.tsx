import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@therapy-aid/shared';
import type { PendingMessage } from '@/services/hooks/use-chat';
import { AssistantBubble, FailedNote, ThinkingBubble, UserBubble } from './MessageBubble';
import './chat-messages.css';

/* The history plus the one in-flight exchange, scrolled so the newest message is in view. The
   optimistic user bubble comes from `pending`, followed by "Thinking…" or the failure note. */
export const MessageList = ({ messages, pending, on_retry, on_discard }: { messages: ChatMessage[]; pending: PendingMessage | null; on_retry: () => void; on_discard: () => void }) => {
    const end = useRef<HTMLDivElement>(null);
    const has_scrolled = useRef(false);

    // First paint jumps to the bottom; later messages glide there.
    useEffect(() => {
        if (messages.length === 0 && pending === null) return;
        end.current?.scrollIntoView?.({ behavior: has_scrolled.current ? 'smooth' : 'auto', block: 'end' });
        has_scrolled.current = true;
    }, [messages.length, pending]);

    return (
        <div className="ta-chat-body" aria-live="polite">
            {messages.map((m) => (m.role === 'user' ? <UserBubble key={m.id} content={m.content} /> : <AssistantBubble key={m.id} content={m.content} created_at={m.created_at} />))}
            {pending && <UserBubble content={pending.content} />}
            {pending && pending.error === null && <ThinkingBubble />}
            {pending && pending.error !== null && <FailedNote message={pending.error} on_retry={on_retry} on_discard={on_discard} />}
            {/* On phones the sticky composer covers the bottom edge; .ta-chat-end leaves room for it. */}
            <div ref={end} aria-hidden className="ta-chat-end" />
        </div>
    );
};
