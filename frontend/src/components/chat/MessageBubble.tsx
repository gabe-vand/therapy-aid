import { Markdown } from '@/components/markdown/Markdown';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import './chat.css';

/* The three things a conversation shows besides plain history: a user's message (plain text,
   right-aligned), the assistant's answer (markdown, full width so lists and quotes breathe),
   and the in-between states of a message that is still being answered or failed. */

export const UserBubble = ({ content }: { content: string }) => (
    <div className="ta-bubble-row ta-bubble-row--user">
        <div className="ta-bubble ta-bubble--user">{content}</div>
    </div>
);

export const AssistantBubble = ({ content }: { content: string }) => (
    <div className="ta-bubble-row">
        <div className="ta-bubble ta-bubble--assistant">
            <Markdown text={content} />
        </div>
    </div>
);

/* The placeholder while the (non-streaming) reply is being written; it can take a minute. */
export const ThinkingBubble = () => (
    <div className="ta-bubble-row">
        <div role="status" className="ta-bubble ta-bubble--assistant ta-bubble--thinking">
            Thinking…
        </div>
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
