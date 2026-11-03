import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/* The "+ New problem" form: a title and an optional description. It owns only its field state;
   the page's hook does the POST (on_submit resolves true on success, which closes the form). */

type Props = { creating: boolean; error: string | null; on_submit: (title: string, description: string) => Promise<boolean>; on_cancel: () => void };

export function NewProblemForm({ creating, error, on_submit, on_cancel }: Props) {
    const [title, set_title] = useState('');
    const [description, set_description] = useState('');

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!title.trim() || creating) return;
        if (await on_submit(title.trim(), description.trim())) on_cancel();
    };

    return (
        <Card as="div" className="mb-5">
            <form onSubmit={submit} className="flex flex-col gap-3" aria-label="New problem">
                <label className="flex flex-col gap-1 text-[14px] font-medium">
                    Title
                    <input className="ta-input" value={title} onChange={(e) => set_title(e.target.value)} placeholder="e.g. Racing mind at night" maxLength={200} autoFocus />
                </label>
                <label className="flex flex-col gap-1 text-[14px] font-medium">
                    What is it? <span className="ta-muted font-normal">(optional)</span>
                    <textarea className="ta-input" rows={3} value={description} onChange={(e) => set_description(e.target.value)} placeholder="A sentence or two, in your own words." />
                </label>
                {error && (
                    <p role="alert" className="text-[14px]" style={{ color: 'var(--danger)' }}>
                        {error}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={on_cancel} disabled={creating}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={!title.trim() || creating}>
                        {creating ? 'Adding…' : 'Add problem'}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
