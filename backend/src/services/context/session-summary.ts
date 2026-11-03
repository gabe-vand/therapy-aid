// Reads sessions.summary_json back into a SessionSummary. Shared by the context pack, the search
// index and the sessions module, so a malformed row degrades the same way everywhere: to null,
// with one log line — never a 500 on a read path.
import type { SessionSummary } from '@therapy-aid/shared';

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

/** The stored summary, or null when absent or unreadable. Missing arrays read as []. */
export const parseSessionSummary = (json: string | null): SessionSummary | null => {
    if (!json) return null;
    try {
        const raw = JSON.parse(json) as Record<string, unknown>;
        return {
            title: typeof raw.title === 'string' ? raw.title : '',
            overview: typeof raw.overview === 'string' ? raw.overview : '',
            key_points: strings(raw.key_points),
            therapist_advice: strings(raw.therapist_advice),
        };
    } catch (e) {
        console.error('[sessions] unreadable summary_json', e);
        return null;
    }
};
