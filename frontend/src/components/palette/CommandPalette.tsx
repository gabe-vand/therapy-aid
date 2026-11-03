import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoaderCircle, Search } from 'lucide-react';
import { Kbd } from '@/components/ui/Kbd';
import { useSearch } from '@/services/hooks/use-search';
import { useTheme } from '@/services/hooks/use-theme';
import { filter_actions, result_path, type PaletteAction } from './palette-actions';
import { ActionRow, ResultRow } from './PaletteRow';
import type { SearchResult } from '@therapy-aid/shared';
import './palette.css';

/* The command palette (Ctrl/⌘+K, "/", or the Search buttons in the shell): one input over a list.
   Empty, it lists the actions (new entry, record, go to…, toggle theme); typing filters those and
   adds full-text hits from sessions and the journal (at most 8), grouped by kind. Arrow keys move,
   Enter chooses, Escape or a click outside closes; choosing navigates. The input is a combobox
   driving a listbox via aria-activedescendant, so focus never leaves it. The dialog body mounts
   only while open, so every open starts with an empty query. AppShell renders the one instance. */

const MAX_RESULTS = 8;

type Item = { key: string; action?: PaletteAction; result?: SearchResult };

export const CommandPalette = ({ open, on_close }: { open: boolean; on_close: () => void }) => (open ? <PaletteDialog on_close={on_close} /> : null);

const PaletteDialog = ({ on_close }: { on_close: () => void }) => {
    const [query, set_query] = useState('');
    const [active, set_active] = useState(0);
    const navigate = useNavigate();
    const { resolved, set_preference } = useTheme();
    const search = useSearch(query);
    const list_id = useId();
    const restore = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
    const list = useRef<HTMLDivElement>(null);

    // Hand focus back to whatever had it (a Search button, the page) when the palette closes.
    useEffect(() => {
        const back_to = restore.current;
        return () => {
            if (back_to instanceof HTMLElement) back_to.focus();
        };
    }, []);

    const results = query.trim() ? search.results.slice(0, MAX_RESULTS) : [];
    const groups = [
        { label: 'Actions', items: filter_actions(query).map((a): Item => ({ key: `a-${a.id}`, action: a })) },
        { label: 'Sessions', items: results.filter((r) => r.kind === 'session').map((r): Item => ({ key: `s-${r.ref_id}`, result: r })) },
        { label: 'Journal', items: results.filter((r) => r.kind === 'journal').map((r): Item => ({ key: `j-${r.ref_id}`, result: r })) },
    ].filter((g) => g.items.length > 0);
    const flat = groups.flatMap((g) => g.items);
    const current = Math.min(active, Math.max(0, flat.length - 1));
    const option_id = (i: number) => `${list_id}-opt-${i}`;

    // Keep the active row in view as the arrows move it.
    useEffect(() => {
        list.current?.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' });
    }, [current]);

    const choose = (item: Item | undefined) => {
        if (!item) return;
        on_close();
        if (item.result) navigate(result_path(item.result));
        else if (item.action?.effect === 'toggle-theme') set_preference(resolved === 'dark' ? 'light' : 'dark');
        else if (item.action?.to) navigate(item.action.to);
    };

    const on_key = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            on_close();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (flat.length === 0) return;
            const step = e.key === 'ArrowDown' ? 1 : -1;
            set_active((current + step + flat.length) % flat.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            choose(flat[current]);
        }
    };

    const empty = flat.length === 0 && !search.searching;

    return (
        <div className="ta-pal-wrap">
            <div className="ta-overlay absolute inset-0" onClick={on_close} aria-hidden />
            <div role="dialog" aria-modal="true" aria-label="Command palette" className="ta-pal" onKeyDown={on_key}>
                <div className="ta-pal__field">
                    <Search aria-hidden className="ta-pal__glass" />
                    <input
                        autoFocus
                        className="ta-pal__input"
                        role="combobox"
                        aria-label="Search or jump to"
                        aria-expanded="true"
                        aria-controls={list_id}
                        aria-autocomplete="list"
                        aria-activedescendant={flat.length > 0 ? option_id(current) : undefined}
                        placeholder="Search sessions and journal, or jump to…"
                        value={query}
                        onChange={(e) => {
                            set_query(e.target.value);
                            set_active(0);
                        }}
                    />
                    {search.searching && <LoaderCircle role="status" aria-label="Searching" className="ta-pal__spin" />}
                    <Kbd>Esc</Kbd>
                </div>
                <div ref={list} id={list_id} role="listbox" aria-label="Results" className="ta-pal__list">
                    {groups.map((g) => (
                        <div key={g.label} role="group" aria-label={g.label} className="ta-pal__group">
                            <p aria-hidden className="ta-pal__group-label">
                                {g.label}
                            </p>
                            {g.items.map((item) => {
                                const i = flat.indexOf(item);
                                const common = { id: option_id(i), active: i === current, on_hover: () => set_active(i), on_choose: () => choose(item) };
                                return item.action ? <ActionRow key={item.key} action={item.action} {...common} /> : <ResultRow key={item.key} result={item.result!} {...common} />;
                            })}
                        </div>
                    ))}
                    {empty && <p className="ta-pal__empty">No matches for “{query.trim()}”.</p>}
                    {search.error && <p className="ta-pal__error">{search.error}</p>}
                </div>
            </div>
        </div>
    );
};
