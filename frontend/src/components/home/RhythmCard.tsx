import type { Dashboard } from '@therapy-aid/shared';
import { Card, Loading, Skeleton } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { format_date } from '@/services/dates';
import { paths } from '@/services/paths';
import { days_ago_phrase, days_since } from './week';
import './home.css';

/* Home's Rhythm block: three stat tiles in one card — when the last session was (and whether the
   next is due, against the usual gap), how much journalling happened lately, and what has been
   written since the last session. Numbers to scan, one muted line of context each. Renders
   nothing on a dashboard error (the Threads block beside it shows that error and its Retry). */

type Props = { dashboard: Dashboard | null; loading: boolean; now?: Date };

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

const Unit = ({ n, one, many }: { n: number; one: string; many?: string }) => (
    <span>
        {n.toLocaleString('en-US')} <span className="ta-stat__unit">{n === 1 ? one : (many ?? `${one}s`)}</span>
    </span>
);

export const RhythmCard = ({ dashboard, loading, now = new Date() }: Props) => {
    if (!dashboard) {
        if (!loading) return null;
        return (
            <section aria-busy="true" className="ta-home-block">
                <p className="ta-eyebrow ta-block-head">Rhythm</p>
                <Loading label="Loading rhythm…">
                    <Card className="flex flex-col gap-5">
                        <Skeleton height={44} />
                        <Skeleton height={44} />
                    </Card>
                </Loading>
            </section>
        );
    }

    const { sessions, journal, since_last_session: since } = dashboard;
    const last = sessions.last;
    const days = last ? days_since(last.occurred_at, now) : 0;
    const gap = sessions.typical_gap_days;
    const due = !!last && gap !== null && days >= gap;
    const due_mark = due ? (
        <span className="ta-due">
            <span aria-hidden className="ta-due__dot" />
            due
        </span>
    ) : null;
    const streak = journal.streak_days > 0 ? `streak ${plural(journal.streak_days, 'day')}` : 'no streak yet';

    return (
        <section aria-labelledby="rhythm-title" className="ta-home-block">
            <h2 id="rhythm-title" className="ta-eyebrow ta-block-head">
                Rhythm
            </h2>
            <Card padded={false} className="ta-stats ta-rhythm overflow-hidden">
                {last ? (
                    <Stat label="Last session" value={format_date(last.occurred_at, { year: false })} aside={due_mark} sub={`${days_ago_phrase(days)}${gap !== null ? ` · usually every ${plural(gap, 'day')}` : ''}`} to={paths.session(last.id)} />
                ) : (
                    <Stat label="Last session" value="None yet" sub="Record one, or add your notes after a session" to={paths.record} />
                )}
                <Stat
                    label="Journal, 30 days"
                    value={<Unit n={journal.entries_30d} one="entry" many="entries" />}
                    sub={`${streak} · ${plural(journal.words_7d, 'word')} this week`}
                    to={journal.last_entry ? paths.journal_entry(journal.last_entry.id) : paths.journal}
                />
                {since && (
                    <Stat
                        label="Since your last session"
                        value={
                            <span>
                                <Unit n={since.entries} one="entry" many="entries" /> <span className="ta-stat__unit">·</span> <Unit n={since.notes} one="margin note" />
                            </span>
                        }
                    />
                )}
            </Card>
        </section>
    );
};
