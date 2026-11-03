import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import './problems-detail.css';

/* Click-to-edit text for a problem's title and description. Reads as plain text with a quiet hover
   outline and a Pencil affordance (always visible on touch); editing swaps in a .ta-input (16px on
   phones) with Save / Cancel. The save is the caller's PATCH (on_save resolves true on success). A
   title may not be blank; a description may be. */

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
            <div className="ta-editable">
                {multiline ? <p className={`ta-editable__value ta-editable__value--prose${value ? '' : ' ta-muted'}`}>{value || placeholder}</p> : <h1 className="ta-editable__value ta-editable__value--title">{value}</h1>}
                <IconButton size="sm" className="ta-editable__pencil" onClick={start} disabled={disabled} aria-label={`Edit ${label}`}>
                    <Pencil size={14} />
                </IconButton>
            </div>
        );
    }

    const field_props = { className: 'ta-input', value: draft, 'aria-label': label, disabled: saving, autoFocus: true, onChange: (e: { target: { value: string } }) => set_draft(e.target.value) };

    return (
        <div className="ta-editable__form">
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
