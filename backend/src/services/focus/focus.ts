// The Focus banner: regenerateFocus() asks Claude (task 'focus') for a headline and 1-3 items over
// the whole context pack, clamps what comes back, and appends it as a new snapshot; getLatestFocus()
// reads the newest one; setCheckin() ticks a day against one item. The sessions pipeline calls regenerateFocus(session.id) after a summary
// lands; the Refresh button calls it with no id. Snapshots are append-only — history is free.
import type { FocusCheckinInput, FocusItem, FocusSnapshot } from '@therapy-aid/shared';
import * as repo_focus from '@/repositories/focus';
import * as repo_problems from '@/repositories/problems';
import * as repo_sessions from '@/repositories/sessions';
import * as svc_claude from '@/services/common/svc-claude';
import { buildContextPack } from '@/services/context/context-pack';
import { formatDay } from '@/services/context/format';
import { parseFocusContent } from '@/services/context/pack-sections';
import { listProblems } from '@/services/problems/problems';
import { lastTouchedMs } from '@/services/problems/staleness';
import { buildFocusRequest, FOCUS_PERSONA, FocusSchema, MAX_FOCUS_ITEMS, type FocusReply } from './prompts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Trims, drops half-empty items, caps at 3, and nulls any problem_id that isn't a real active problem. */
export const clampFocus = (reply: FocusReply, known_problem_ids: Set<number>): { headline: string; items: FocusItem[] } => {
    const items = reply.items
        .map((i) => ({ title: i.title.trim(), why: i.why.trim(), action: i.action.trim(), problem_id: i.problem_id !== null && known_problem_ids.has(i.problem_id) ? i.problem_id : null }))
        .filter((i) => i.title && i.action)
        .slice(0, MAX_FOCUS_ITEMS);
    return { headline: reply.headline.trim(), items };
};

const toSnapshot = (row: repo_focus.FocusSnapshotRow): FocusSnapshot | null => {
    const content = parseFocusContent(row.content_json);
    if (!content) return null;
    const items = content.items.map((i) => ({ ...i, problem_id: i.problem_id ?? null }));
    const checkins = repo_focus.selectCheckins(row.id).map((c) => ({ item_index: c.item_index, day: c.day }));
    return { id: row.id, session_id: row.session_id, created_at: row.created_at, headline: content.headline, items, checkins };
};

/** The current focus, or null before the first one (or when the stored JSON is unreadable). */
export const getLatestFocus = (): FocusSnapshot | null => {
    const row = repo_focus.selectLatestFocusSnapshot();
    return row ? toSnapshot(row) : null;
};

/** Ticks or unticks one item's action for one day on the CURRENT focus. Null when there is no
    focus or the item index is out of range; the day must already be validated (YYYY-MM-DD). */
export const setCheckin = (input: FocusCheckinInput): FocusSnapshot | null => {
    const current = getLatestFocus();
    if (!current || input.item_index < 0 || input.item_index >= current.items.length) return null;
    const key = { snapshot_id: current.id, item_index: input.item_index, day: input.day };
    if (input.done) repo_focus.insertCheckin(key);
    else repo_focus.deleteCheckin(key);
    return getLatestFocus();
};

/** Generates and stores a new focus. `session_id` is the session that triggered it (null = on demand).
    Throws an AiError (not configured / refused / unusable reply) without storing anything. */
export const regenerateFocus = async (session_id?: number | null): Promise<FocusSnapshot> => {
    const now = Date.now();
    const session = session_id ? repo_sessions.selectSessionById(session_id) : null;
    const stale = listProblems({ now }).filter((p) => p.is_stale);
    const request = buildFocusRequest({
        today: formatDay(new Date(now).toISOString()),
        triggered_by: session ? { id: session.id, title: session.title, day: formatDay(session.occurred_at) } : null,
        stale_problems: stale.map((p) => ({
            id: p.id,
            title: p.title,
            // The same "last touched" as the staleness rule (and Home's prompt): the newest of the three.
            days: Math.floor((now - lastTouchedMs(p)) / DAY_MS),
        })),
    });

    const reply = await svc_claude.completeStructured({ task: 'focus', system: svc_claude.systemBlocks([FOCUS_PERSONA, buildContextPack()]), messages: [{ role: 'user', content: request }], schema: FocusSchema });

    const known = new Set(repo_problems.selectProblemsByStatus(['active']).map((p) => p.id));
    const focus = clampFocus(reply, known);
    if (!focus.headline || focus.items.length === 0) throw new svc_claude.AiOutputError('The AI model returned an empty focus. Try refreshing again.');

    const row = repo_focus.insertFocusSnapshot({ session_id: session?.id ?? null, content_json: JSON.stringify(focus) });
    return toSnapshot(row)!;
};
