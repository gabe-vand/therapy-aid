import { useState, type KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import './chat-messages.css';

/* The message box: a rounded field with a round accent Send. Enter sends, Shift+Enter makes a
   newline (the Send button covers touch keyboards). The text is cleared the moment it is handed
   over — the conversation keeps its own copy for Retry — and is kept when `disabled` (an answer is
   still pending) so nothing is lost. */
export const Composer = ({ on_send, disabled = false }: { on_send: (text: string) => void; disabled?: boolean }) => {
    const [text, set_text] = useState('');

    const submit = () => {
        const trimmed = text.trim();
        if (trimmed === '' || disabled) return;
        set_text('');
        on_send(trimmed);
    };

    // isComposing: Enter that confirms an IME candidate must not send.
    const on_key_down = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };

    return (
        <div className="ta-composer-wrap">
            <form
                className="ta-composer"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}>
                <div className="ta-composer__box">
                    <textarea
                        aria-label="Message"
                        className="ta-composer__field"
                        rows={1}
                        enterKeyHint="send"
                        placeholder="Ask about your sessions, problems or journal…"
                        value={text}
                        onChange={(e) => set_text(e.target.value)}
                        onKeyDown={on_key_down}
                    />
                    <IconButton type="submit" variant="primary" aria-label="Send" className="ta-composer__send" disabled={disabled || text.trim() === ''}>
                        <ArrowUp aria-hidden />
                    </IconButton>
                </div>
            </form>
        </div>
    );
};
