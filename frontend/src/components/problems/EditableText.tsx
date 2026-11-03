import { useState } from 'react';
import { Button } from '@/components/ui/Button';

/* Click-to-edit text for a problem's title and description. Shows the value with a quiet "Edit"
   button; editing swaps in an input/textarea with Save / Cancel. The save is the caller's PATCH
   (on_save resolves true on success). A title may not be blank; a description may be. */

type Props = {
    value: string;
    label: string; // accessible name, also used for "Edit title" / "Save title"
    multiline?: boolean;
    required?: boolean;
    placeholder?: string;
    disabled?: boolean;
    on_save: (value: string) => Promise<boolean>;
};

export function EditableText({ value, label, multiline = false, required = false, placeholder = 'Nothing here yet.', disabled = false, on_save }: Props) {
    const [editing, set_editing] = useState(false);
    const [draft, set_draft] = useState(value);
    const [saving, set_saving] = useState(false);

    const start = () => {
        set_draft(value);
        set_editing(true);
    };

    const save = async () => {
        const next = draft.trim();
        if (required && !next) return;
        if (next === value) return set_editing(false);
        set_saving(true);
        const ok = await on_save(next);
        set_saving(false);
        if (ok) set_editing(false);
    };

    if (!editing) {
        return (
            <div className="flex items-start justify-between gap-3">
                {multiline ? <p className={`min-w-0 whitespace-pre-wrap text-[16px] ${value ? '' : 'ta-muted'}`}>{value || placeholder}</p> : <h1 className="min-w-0 text-2xl font-semibold leading-tight tracking-tight md:text-3xl">{value}</h1>}
                <Button size="sm" variant="ghost" onClick={start} disabled={disabled} aria-label={`Edit ${label}`}>
                    Edit
                </Button>
            </div>
        );
    }

    const field_props = { className: 'ta-input', value: draft, 'aria-label': label, disabled: saving, autoFocus: true, onChange: (e: { target: { value: string } }) => set_draft(e.target.value) };

    return (
        <div className="flex flex-col gap-2">
            {multiline ? <textarea rows={4} {...field_props} /> : <input maxLength={200} {...field_props} />}
            <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => set_editing(false)} disabled={saving}>
                    Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={() => void save()} disabled={saving || (required && !draft.trim())} aria-label={`Save ${label}`}>
                    {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
        </div>
    );
}
