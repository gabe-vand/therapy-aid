import type { ReactNode } from 'react';
import { CornerDownLeft, Mic, NotebookPen } from 'lucide-react';
import type { SearchResult } from '@therapy-aid/shared';
import { format_date } from '@/services/dates';
import { snippet_parts, type PaletteAction } from './palette-actions';
import './palette.css';

/* One option in the command palette's listbox — an action (icon + label) or a search result (kind
   icon, title, date, and the snippet with the matched words as <mark>). The palette owns which row
   is active (arrow keys / hover); the row only reports hover and click. */

type Common = { id: string; active: boolean; on_hover: () => void; on_choose: () => void };

const Option = ({ id, active, on_hover, on_choose, children, label }: Common & { children: ReactNode; label?: string }) => (
    <div id={id} role="option" aria-selected={active} aria-label={label} className={`ta-pal-row${active ? ' is-active' : ''}`} onMouseMove={active ? undefined : on_hover} onClick={on_choose}>
        {children}
        {active && <CornerDownLeft aria-hidden className="ta-pal-row__enter" />}
    </div>
);

export const ActionRow = ({ action, ...common }: Common & { action: PaletteAction }) => (
    <Option {...common} label={action.label}>
        <action.Icon aria-hidden className="ta-pal-row__icon" />
        <span className="ta-pal-row__title">{action.label}</span>
    </Option>
);

export const ResultRow = ({ result, ...common }: Common & { result: SearchResult }) => {
    const Icon = result.kind === 'session' ? Mic : NotebookPen;
    return (
        <Option {...common}>
            <Icon aria-hidden className="ta-pal-row__icon ta-pal-row__icon--top" />
            <span className="ta-pal-row__body">
                <span className="ta-pal-row__line">
                    <span className="ta-pal-row__title">{result.title}</span>
                    <span className="ta-pal-row__date ta-num">{format_date(result.occurred_at)}</span>
                </span>
                <span className="ta-pal-row__snippet">{snippet_parts(result.snippet).map((p, i) => (p.match ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}</span>
            </span>
        </Option>
    );
};
