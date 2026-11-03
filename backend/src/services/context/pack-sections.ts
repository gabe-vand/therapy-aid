// The sections of the context pack, each a pure function of rows (no I/O, no clock), so the pack
// is deterministic and each section is testable on its own. Ids appear as [session #4],
// [problem #3], [entry #12] — the same handles the chat tools and the focus schema take.
import type { FocusItem } from '@therapy-aid/shared';
import type { FocusSnapshotRow } from '@/repositories/focus';
import type { JournalEntryRow } from '@/repositories/journal';
import type { ProblemUpdateWithSession } from '@/repositories/problem-updates';
import type { ProblemRow } from '@/repositories/problems';
import type { SessionSummaryRow } from '@/repositories/sessions';
import { bullets, formatDay, truncateWords } from './format';
import { parseSessionSummary } from './session-summary';

export const JOURNAL_WORD_LIMIT = 700;

/** focus_snapshots.content_json → { headline, items }, or null when unreadable. */
export const parseFocusContent = (json: string): { headline: string; items: FocusItem[] } | null => {
    try {
        const raw = JSON.parse(json) as { headline?: unknown; items?: unknown };
        if (typeof raw.headline !== 'string' || !Array.isArray(raw.items)) return null;
        return { headline: raw.headline, items: raw.items as FocusItem[] };
    } catch (e) {
        console.error('[focus] unreadable content_json', e);
        return null;
    }
};

/** # About Gabe */
export const renderProfile = (profile: string): string => `# About Gabe\n\n${profile.trim() || '(No profile written yet.)'}`;

/** # Current focus — headline + numbered items. */
export const renderFocus = (snapshot: FocusSnapshotRow | null): string => {
    const content = snapshot ? parseFocusContent(snapshot.content_json) : null;
    if (!content) return '# Current focus\n\n(No focus generated yet.)';
    const items = content.items.map((item, i) => {
        const ref = item.problem_id ? ` [problem #${item.problem_id}]` : '';
        return `${i + 1}. **${item.title}**${ref} — ${item.why} Action: ${item.action}`;
    });
    return `# Current focus\n\n${content.headline}\n\n${items.join('\n')}`.trimEnd();
};

/** The day a problem was last touched — what "last discussed" sorts and reads by. */
const lastActivity = (p: ProblemRow): string => p.last_discussed_at ?? p.created_at;

/** # Problems — active ones in full (most recently discussed first, last 2 notes each), then
    resolved titles. `updates` maps problem id → its newest notes (newest first). */
export const renderProblems = (active: ProblemRow[], resolved: ProblemRow[], updates: Map<number, ProblemUpdateWithSession[]>): string => {
    if (active.length === 0 && resolved.length === 0) return '# Problems\n\n(No problems recorded yet.)';
    const sorted = [...active].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)) || a.id - b.id);
    const blocks = sorted.map((p) => {
        const notes = (updates.get(p.id) ?? []).slice(0, 2).map((u) => {
            const from = u.session_id ? ` [session #${u.session_id}]` : u.source === 'manual' ? ' (Gabe’s note)' : '';
            return `- ${formatDay(u.created_at)}${from}: ${u.body.trim()}`;
        });
        const lines = [`### ${p.title} [problem #${p.id}]`, p.description.trim(), `Last discussed: ${p.last_discussed_at ? formatDay(p.last_discussed_at) : 'not yet'}`];
        if (notes.length) lines.push(`Recent notes:\n${notes.join('\n')}`);
        return lines.filter(Boolean).join('\n');
    });
    const parts = ['# Problems'];
    if (blocks.length) parts.push(`## Active\n\n${blocks.join('\n\n')}`);
    if (resolved.length) parts.push(`## Resolved\n\n${bullets(resolved.map((p) => `${p.title} [problem #${p.id}]`))}`);
    return parts.join('\n\n');
};

/** One session in full: date, title, overview, key points, David's advice. */
export const renderSessionFull = (row: SessionSummaryRow): string => {
    const summary = parseSessionSummary(row.summary_json);
    const lines = [`## ${formatDay(row.occurred_at)} — ${row.title ?? summary?.title ?? 'Untitled'} [session #${row.id}]`];
    if (summary?.overview.trim()) lines.push(summary.overview.trim());
    if (summary?.key_points.length) lines.push(`Key points:\n${bullets(summary.key_points)}`);
    if (summary?.therapist_advice.length) lines.push(`What David suggested:\n${bullets(summary.therapist_advice)}`);
    return lines.join('\n\n');
};

/** One session condensed to a single line: date, title, key points. */
export const renderSessionLine = (row: SessionSummaryRow): string => {
    const summary = parseSessionSummary(row.summary_json);
    const points = summary?.key_points.map((p) => p.trim().replace(/[.;]+$/, '')).join('; ');
    return `- ${formatDay(row.occurred_at)} — ${row.title ?? summary?.title ?? 'Untitled'} [session #${row.id}]${points ? `: ${points}` : ''}`;
};

/** # Recent journal entries — full text, each cut to JOURNAL_WORD_LIMIT words. */
export const renderJournal = (entries: JournalEntryRow[]): string => {
    if (entries.length === 0) return '# Recent journal entries (newest first)\n\n(No journal entries yet.)';
    const blocks = entries.map((e) => `## ${formatDay(e.occurred_at)} [entry #${e.id}]\n\n${truncateWords(e.body, JOURNAL_WORD_LIMIT) || '(empty)'}`);
    return `# Recent journal entries (newest first)\n\n${blocks.join('\n\n')}`;
};

/** The problem list as the map_problems call needs it: every non-discarded problem with id,
    status, description and newest note — so the model can map onto an existing one by id. */
export const renderProblemsForMapping = (problems: ProblemRow[], updates: Map<number, ProblemUpdateWithSession[]>): string => {
    if (problems.length === 0) return '# Existing problems\n\n(None yet — every durable theme would be new.)';
    const lines = problems.map((p) => {
        const latest = updates.get(p.id)?.[0];
        const note = latest ? ` Latest note (${formatDay(latest.created_at)}): ${latest.body.trim()}` : '';
        return `- [problem #${p.id}] (${p.status}) ${p.title} — ${p.description.trim().replace(/\.+$/, '') || 'no description'}.${note}`;
    });
    return `# Existing problems\n\n${lines.join('\n')}`;
};
