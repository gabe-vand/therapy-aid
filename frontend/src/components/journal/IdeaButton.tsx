import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { IDEA_PAUSE_MS, idea_visible, idea_wants_pulse } from './idea-rules';
import './journal.css';

/* The "💡 I have an idea…" button. Hidden until the draft is long enough to say something; then it
   sits quietly, and pulses ONCE (per baseline) after the writer has grown the draft by 200+
   characters and stopped typing for 4 seconds. Only a click ever calls `on_click` — nothing here
   generates on its own. Typing again restarts the 4s wait, because the effect depends on `draft`. */

type Props = { draft: string; baseline: number; busy: boolean; disabled?: boolean; on_click: () => void };

export function IdeaButton({ draft, baseline, busy, disabled = false, on_click }: Props) {
    // The baseline we last pulsed for. Pulsing is DERIVED from it, so a new insight (which moves the
    // baseline) calms the pulse in the same render, and allows one more pulse later.
    const [pulsed_for, set_pulsed_for] = useState<number | null>(null);
    const pulsing = pulsed_for === baseline;

    useEffect(() => {
        if (pulsed_for === baseline || !idea_wants_pulse(draft.length, baseline)) return;
        const timer = setTimeout(() => set_pulsed_for(baseline), IDEA_PAUSE_MS);
        return () => clearTimeout(timer);
    }, [draft, baseline, pulsed_for]);

    if (!idea_visible(draft.length)) return null;
    return (
        <Button variant="secondary" className={pulsing ? 'ta-idea ta-idea--pulse' : 'ta-idea'} data-pulsing={pulsing} disabled={busy || disabled} onClick={on_click}>
            <span aria-hidden>💡</span> {busy ? 'Thinking it over…' : 'I have an idea…'}
        </Button>
    );
}
