import { Link } from 'react-router-dom';
import type { FocusSnapshot } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Card, Loading, Skeleton } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { relative_time } from '@/services/dates';
import { paths } from '@/services/paths';

/* The banner at the top of Home: what to focus on right now. A one-line headline and up to three
   cards (what, why, and the one thing to do this week). Refresh regenerates it from the whole
   picture; before the first session there is nothing to show, and the empty state says why. */

type Props = { focus: FocusSnapshot | null; loading: boolean; error: string | null; on_reload: () => void; on_regenerate: () => void; regenerating: boolean; regenerate_error: string | null };

export const FocusHero = ({ focus, loading, error, on_reload, on_regenerate, regenerating, regenerate_error }: Props) => {
    if (loading && !focus) {
        return (
            <Loading label="Loading your focus…">
                <Skeleton height={28} className="mb-4 w-4/5" />
                <Skeleton height={96} className="mb-3" />
                <Skeleton height={96} />
            </Loading>
        );
    }
    if (error && !focus) return <ErrorState message={error} on_retry={on_reload} />;
    if (!focus) {
        return <EmptyState title="Your focus will appear here" body="After your first session, this shows what to concentrate on right now, drawn from everything you and David have covered. Add a session to get started." />;
    }

    return (
        <section aria-labelledby="focus-headline" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
                    Your focus right now
                </p>
                <div className="flex items-center gap-3">
                    <span className="ta-muted text-sm">Updated {relative_time(focus.created_at)}</span>
                    <Button size="sm" onClick={on_regenerate} disabled={regenerating}>
                        {regenerating ? 'Refreshing…' : 'Refresh'}
                    </Button>
                </div>
            </div>
            <h2 id="focus-headline" className="text-2xl font-semibold leading-snug tracking-tight md:text-[28px]">
                {focus.headline}
            </h2>
            {regenerate_error && <ErrorState message={regenerate_error} />}
            <ul className="flex flex-col gap-3" aria-busy={regenerating}>
                {focus.items.map((item) => (
                    <li key={item.title}>
                        <Card as="article" className="flex flex-col gap-2" style={{ opacity: regenerating ? 0.6 : 1 }}>
                            <h3 className="text-lg font-semibold">{item.title}</h3>
                            <p className="leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                                {item.why}
                            </p>
                            <p className="mt-1 rounded-xl px-3 py-2 text-[15px] leading-relaxed" style={{ background: 'var(--accent-soft)' }}>
                                <span className="font-semibold">This week: </span>
                                {item.action}
                            </p>
                            {item.problem_id !== null && (
                                <Link to={paths.problem(item.problem_id)} className="text-sm font-medium underline-offset-2 hover:underline" style={{ color: 'var(--accent)' }}>
                                    See the related problem →
                                </Link>
                            )}
                        </Card>
                    </li>
                ))}
            </ul>
        </section>
    );
};
