import { ArrowDown, MessageSquareText } from 'lucide-react';
import { MarginNote } from './MarginNote';
import type { MarginView } from './use-margin-view';
import './margin-notes.css';

/* The three pieces that show the open entry's margin notes, driven by one useMarginView:
   - MarginColumn: the 240px column beside the document on a wide pane (the grid's second cell,
     journal-editor.css), each anchored card absolutely positioned at its paragraph's height;
   - MarginList: under the document — every note when the pane is narrow, or only the notes whose
     paragraph could not be found when it is wide — each quoting its paragraph's opening words;
   - NotePill: the fixed "New margin note" button a phone shows when one arrives below the fold.
   A note that just arrived fades in (`fresh`). */

type Props = { view: MarginView; on_dismiss: (id: number) => void };

export function MarginColumn({ view, on_dismiss }: Props) {
    return (
        <aside ref={view.column_ref} className="ta-margin" aria-label="Margin notes" data-layout={view.wide ? 'margin' : 'inline'}>
            {view.wide &&
                view.placed
                    .filter((p) => p.top !== null)
                    .map(({ note, top }) => (
                        <div key={note.id} className="ta-margin__slot" style={{ top: top ?? 0 }}>
                            <MarginNote note={note} fresh={view.fresh === note.id} on_dismiss={on_dismiss} />
                        </div>
                    ))}
        </aside>
    );
}

export function MarginList({ view, on_dismiss }: Props) {
    const listed = view.wide ? view.placed.filter((p) => p.top === null) : view.placed;
    if (listed.length === 0) return null;
    return (
        <section className="ta-margin-list" aria-label="Margin notes list">
            <h2 className="ta-margin-list__eyebrow">
                <MessageSquareText aria-hidden />
                Margin notes
            </h2>
            {listed.map(({ note }) => (
                <MarginNote key={note.id} note={note} quote={note.anchor} fresh={view.fresh === note.id} on_dismiss={on_dismiss} />
            ))}
        </section>
    );
}

export function NotePill({ view }: { view: MarginView }) {
    if (view.pill === null) return null;
    const id = view.pill;
    return (
        <button type="button" className="ta-note-pill" onClick={() => view.jump(id)}>
            <MessageSquareText aria-hidden />
            New margin note
            <ArrowDown aria-hidden />
        </button>
    );
}
