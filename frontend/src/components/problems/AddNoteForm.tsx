import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';

/* "Add a note": a manual progress note on a problem (what happened, what you tried), at the top of
   the timeline rail. The hook does the POST; the box clears only when it succeeded, so a failed
   note is never lost. The button only appears once there is something to add. */

export function AddNoteForm({ busy, on_add }: { busy: boolean; on_add: (body: string) => Promise<boolean> }) {
    const [body, set_body] = useState('');

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!body.trim() || busy) return;
        if (await on_add(body.trim())) set_body('');
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-2">
            <label htmlFor="problem-note" className="ta-muted text-[12px] font-medium">
                Add a note
            </label>
            <textarea id="problem-note" className="ta-input" rows={2} value={body} onChange={(e) => set_body(e.target.value)} placeholder="How is this going? What did you notice or try this week?" />
            <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm" disabled={!body.trim() || busy}>
                    {busy ? 'Adding…' : 'Add note'}
                </Button>
            </div>
        </form>
    );
}
