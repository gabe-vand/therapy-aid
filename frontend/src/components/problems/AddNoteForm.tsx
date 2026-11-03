import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';

/* "Add a note": a manual progress note on a problem (what happened, what you tried). The hook does
   the POST; the box clears only when it succeeded, so a failed note is never lost. */

export function AddNoteForm({ busy, on_add }: { busy: boolean; on_add: (body: string) => Promise<boolean> }) {
    const [body, set_body] = useState('');

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!body.trim() || busy) return;
        if (await on_add(body.trim())) set_body('');
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-2">
            <label htmlFor="problem-note" className="text-[13px] font-medium">
                Add a note
            </label>
            <textarea id="problem-note" className="ta-input" style={{ fontSize: 16 }} rows={3} value={body} onChange={(e) => set_body(e.target.value)} placeholder="How is this going? What did you notice or try this week?" />
            <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm" disabled={!body.trim() || busy}>
                    {busy ? 'Adding…' : 'Add note'}
                </Button>
            </div>
        </form>
    );
}
