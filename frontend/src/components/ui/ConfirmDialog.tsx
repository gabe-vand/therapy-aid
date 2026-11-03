import { useEffect, type ReactNode } from 'react';
import { Button } from './Button';
import './ui.css';

/* The confirmation every destructive action goes through (delete, discard, resolve). Controlled:
   the caller owns `open`. Escape or the backdrop cancels; the confirm button shows `busy` while
   the caller's mutation runs, so a double-tap can't fire it twice. */

type Props = {
    open: boolean;
    title: string;
    body?: ReactNode;
    confirm_label: string;
    tone?: 'danger' | 'primary';
    busy?: boolean;
    on_confirm: () => void;
    on_cancel: () => void;
};

export const ConfirmDialog = ({ open, title, body, confirm_label, tone = 'danger', busy = false, on_confirm, on_cancel }: Props) => {
    useEffect(() => {
        if (!open) return;
        const on_key = (e: KeyboardEvent) => {
            if (e.key === 'Escape') on_cancel();
        };
        window.addEventListener('keydown', on_key);
        return () => window.removeEventListener('keydown', on_key);
    }, [open, on_cancel]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
            <div className="ta-overlay absolute inset-0" onClick={on_cancel} aria-hidden />
            <div role="dialog" aria-modal="true" aria-labelledby="ta-confirm-title" className="ta-dialog relative w-full max-w-sm p-6">
                <h2 id="ta-confirm-title" className="text-lg font-semibold">
                    {title}
                </h2>
                {body && <div className="ta-muted mt-2 text-[15px]">{body}</div>}
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="ghost" onClick={on_cancel} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant={tone} onClick={on_confirm} disabled={busy} autoFocus>
                        {busy ? 'Working…' : confirm_label}
                    </Button>
                </div>
            </div>
        </div>
    );
};
