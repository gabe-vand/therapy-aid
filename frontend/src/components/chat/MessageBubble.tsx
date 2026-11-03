import { Markdown } from '@/components/markdown/Markdown';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { format_time } from '@/services/dates';
import './chat-messages.css';
import './chat-bubbles.css';

/* The things a conversation shows: the user's message (a soft accent bubble, plain text,
   right-aligned), the assistant's answer (no bubble — markdown prose under a small "therapy-aid ·
   time" label, full width so lists and quotes breathe; the user's own time appears on hover), and the in-between states of a message
   that is still being answered or failed. */

/* The time shows beside the bubble on hover (and on focus within, for keyboards). */
export const UserBubble = ({ content, created_at }: { content: string; created_at?: string }) => (
    <div className="ta-bubble-row ta-bubble-row--user">
        {created_at && (
            <time className="ta-bubble__time" dateTime={created_at}>
                {format_time(created_at)}
            </time>
        )}
        <div className="ta-bubble--user">{content}</div>
    </div>
);

const Label = ({ time }: { time?: string }) => (
    <div className="ta-msg__label">
        <strong>therapy-aid</strong>
        {time && <span>{time}</span>}
    </div>
);

export const AssistantBubble = ({ content, created_at }: { content: string; created_at?: string }) => (
    <div className="ta-msg">
        <Label time={created_at ? format_time(created_at) : undefined} />
        <Markdown text={content} />
    </div>
);

/* The placeholder while the (non-streaming) reply is being written; it can take a minute. A thin
   accent bar sweeps over a hairline under the word, so it reads as alive without a spinner. */
export const ThinkingBubble = () => (
    <div className="ta-msg">
        <Label />
        <div role="status" className="ta-bubble--thinking">
            Thinking…
        </div>
        <div className="ta-thinking-bar" aria-hidden />
    </div>
);

/* A send that failed: the reason, a Retry that resends the same text, and a way to drop it. */
export const FailedNote = ({ message, on_retry, on_discard }: { message: string; on_retry: () => void; on_discard: () => void }) => (
    <div className="flex flex-col items-end gap-2">
        <div className="w-full">
            <ErrorState message={message} on_retry={on_retry} />
        </div>
        <Button variant="ghost" size="sm" onClick={on_discard}>
            Discard message
        </Button>
    </div>
);
