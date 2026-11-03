// The narrow evidence a margin note is written from — instead of the whole context pack. One
// problem (its description and last notes, each dated and tied to its session) plus the sessions
// whose text matches the paragraph best (full-text search), rendered with David's advice and key
// points. A few thousand tokens at most, which is what lets the writer run on a mid-tier model.
import * as repo_updates from '@/repositories/problem-updates';
import type { ProblemRow } from '@/repositories/problems';
import * as repo_sessions from '@/repositories/sessions';
import { formatDay } from '@/services/context/format';
import { parseSessionSummary } from '@/services/context/session-summary';
import { searchDocuments } from '@/services/search/search';

const PROBLEM_NOTES = 4;
const MATCHED_SESSIONS = 3;
const KEY_POINTS = 6;

/** Sessions whose summaries, advice or notes best match the paragraph, plus the problem's own
    origin session when it is a ready one. Ids only; deduplicated, best match first. */
export const relatedSessionIds = (paragraph: string, problem: ProblemRow): number[] => {
    const ids = searchDocuments(paragraph, { kind: 'session', limit: MATCHED_SESSIONS }).map((hit) => hit.ref_id);
    if (problem.origin_session_id !== null && !ids.includes(problem.origin_session_id)) ids.push(problem.origin_session_id);
    return ids;
};

const renderSession = (id: number): string | null => {
    const row = repo_sessions.selectSessionById(id);
    if (!row || row.status !== 'ready') return null;
    const summary = parseSessionSummary(row.summary_json);
    const lines = [`## ${formatDay(row.occurred_at)} — ${row.title ?? summary?.title ?? 'Untitled'} [session #${row.id}]`];
    if (summary?.key_points.length)
        lines.push(
            `Key points:\n${summary.key_points
                .slice(0, KEY_POINTS)
                .map((p) => `- ${p.trim()}`)
                .join('\n')}`,
        );
    if (summary?.therapist_advice.length) lines.push(`What David suggested:\n${summary.therapist_advice.map((a) => `- ${a.trim()}`).join('\n')}`);
    return lines.join('\n');
};

/** The evidence block of the note prompt. */
export const buildNoteEvidence = (problem: ProblemRow, paragraph: string): string => {
    const notes = repo_updates.selectUpdatesForProblem(problem.id, PROBLEM_NOTES).map((u) => {
        const from = u.session_id ? ` [session #${u.session_id}${u.session_title ? `, "${u.session_title}"` : ''}]` : u.source === 'manual' ? ' (Gabe’s own note)' : '';
        return `- ${formatDay(u.created_at)}${from}: ${u.body.trim()}`;
    });
    const problem_block = [`# The problem this paragraph is about`, `**${problem.title}** [problem #${problem.id}]`, problem.description.trim(), `Last discussed: ${problem.last_discussed_at ? formatDay(problem.last_discussed_at) : 'not yet'}`];
    if (notes.length) problem_block.push(`Recent notes (newest first):\n${notes.join('\n')}`);

    const sessions = relatedSessionIds(paragraph, problem)
        .map(renderSession)
        .filter((s): s is string => s !== null);
    const sessions_block = sessions.length ? `# Sessions that bear on it\n\n${sessions.join('\n\n')}` : '# Sessions that bear on it\n\n(No session matched this paragraph closely.)';

    return `${problem_block.filter(Boolean).join('\n')}\n\n${sessions_block}`;
};
