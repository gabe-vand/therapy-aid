import { FileText, House, MessageSquare, Mic, NotebookPen, Settings, SunMoon, Target, type LucideIcon } from 'lucide-react';
import type { SearchResult } from '@therapy-aid/shared';
import { paths } from '@/services/paths';

/* What the command palette can do without a search: create something, go somewhere, flip the
   theme. Each action either navigates (`to`) or runs a named effect the palette knows how to
   perform (`effect`). Matching is plain: every word of the query must appear in the label or the
   keywords, case-insensitive. Also the result → URL mapping, so palette and tests agree. */

export type PaletteAction = { id: string; label: string; Icon: LucideIcon; keywords: string; to?: string; effect?: 'toggle-theme' };

export const ACTIONS: PaletteAction[] = [
    { id: 'new-entry', label: 'New journal entry', Icon: NotebookPen, keywords: 'write journal create', to: paths.journal_new },
    { id: 'record', label: 'Record a session', Icon: Mic, keywords: 'new session audio microphone', to: paths.record },
    { id: 'notes', label: 'Add notes', Icon: FileText, keywords: 'new session paste upload', to: paths.upload_notes },
    { id: 'go-home', label: 'Go to Home', Icon: House, keywords: 'dashboard focus today', to: paths.home },
    { id: 'go-sessions', label: 'Go to Sessions', Icon: Mic, keywords: 'list', to: paths.sessions },
    { id: 'go-problems', label: 'Go to Problems', Icon: Target, keywords: 'threads', to: paths.problems },
    { id: 'go-journal', label: 'Go to Journal', Icon: NotebookPen, keywords: 'entries', to: paths.journal },
    { id: 'go-chat', label: 'Go to Chat', Icon: MessageSquare, keywords: 'ask', to: paths.chat },
    { id: 'go-settings', label: 'Go to Settings', Icon: Settings, keywords: 'profile usage appearance', to: paths.settings },
    { id: 'theme', label: 'Toggle theme', Icon: SunMoon, keywords: 'dark light mode appearance', effect: 'toggle-theme' },
];

export const filter_actions = (query: string): PaletteAction[] => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return ACTIONS;
    return ACTIONS.filter((a) => {
        const hay = `${a.label} ${a.keywords}`.toLowerCase();
        return words.every((w) => hay.includes(w));
    });
};

export const result_path = (r: SearchResult): string => (r.kind === 'session' ? paths.session(r.ref_id) : paths.journal_entry(r.ref_id));

/* The search snippet split into plain text and matched terms (the API wraps matches in [ ]). */
export const snippet_parts = (snippet: string): { text: string; match: boolean }[] =>
    snippet
        .split(/(\[[^\]]*\])/)
        .filter(Boolean)
        .map((part) => (part.startsWith('[') && part.endsWith(']') ? { text: part.slice(1, -1), match: true } : { text: part, match: false }));
