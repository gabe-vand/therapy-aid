import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import './sessions.css';

/* A closed-by-default card for long raw text (the transcript, the notes as typed). Native
   <details>, so it is keyboard- and screen-reader-accessible with no state of ours. The text is
   rendered verbatim — pre-wrapped, never as markdown — because it is source material, not prose. */
export const Collapsible = ({ title, hint, text, children }: { title: string; hint?: string; text?: string; children?: ReactNode }) => (
    <details className="ta-details ta-card">
        <summary>
            <span>
                {title}
                {hint && <span className="ta-muted ml-2 text-sm font-normal">{hint}</span>}
            </span>
            <ChevronDown size={16} aria-hidden />
        </summary>
        {text !== undefined ? <div className="ta-transcript">{text}</div> : children}
    </details>
);
