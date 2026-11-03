/* A stand-in for components/journal/RichEditor in page tests: happy-dom cannot lay out
   ProseMirror, so the TipTap editor becomes a textarea with the same contract — `value` is the
   initial content, every edit reports the new Markdown through `on_change`, and `label` is the
   accessible name. Use: vi.mock('@/components/journal/RichEditor', () => import('../helpers/hlp-rich-editor')).
   The real formatting bar is covered by tests/components/journal/EditorToolbar.test.tsx. */

type Props = { value: string; on_change: (markdown: string) => void; label: string; placeholder?: string };

export const RichEditor = ({ value, on_change, label, placeholder }: Props) => <textarea aria-label={label} placeholder={placeholder} defaultValue={value} onChange={(e) => on_change(e.target.value)} />;
