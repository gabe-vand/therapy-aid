// The one rule for "still relevant?": an ACTIVE problem is stale when nothing has touched it in
// 30 days. "Touched" = the latest of last_discussed_at (a session or a manual note), last_reviewed_at
// (Gabe pressed Keep) and created_at. Resolved and discarded problems are never stale. Pure.
import type { ProblemRow } from '@/repositories/problems';

export const STALE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Epoch ms of the most recent touch; unparseable stamps count as 0 (so they read as old). */
export const lastTouchedMs = (p: Pick<ProblemRow, 'last_discussed_at' | 'last_reviewed_at' | 'created_at'>): number => {
    const stamps = [p.last_discussed_at, p.last_reviewed_at, p.created_at].map((s) => (s ? Date.parse(s) : NaN));
    return Math.max(0, ...stamps.filter((t) => !Number.isNaN(t)));
};

/** True when the problem is active and its last touch is strictly more than 30 days before `now`
    (exactly 30 days is still fresh; the 31st day flags it). */
export const isStale = (p: Pick<ProblemRow, 'status' | 'last_discussed_at' | 'last_reviewed_at' | 'created_at'>, now: number = Date.now()): boolean =>
    p.status === 'active' && now - lastTouchedMs(p) > STALE_AFTER_DAYS * DAY_MS;
