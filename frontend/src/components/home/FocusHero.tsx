import { Link } from 'react-router-dom';
import type { FocusSnapshot } from '@therapy-aid/shared';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, Loading, Skeleton } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { relative_time } from '@/services/dates';
import { paths } from '@/services/paths';

/* The banner at the top of Home: what to focus on right now. A one-line headline and up to three
   cards (what, why, and the one thing to do this week). Refresh regenerates it from the whole
   picture. With no focus there are two empty states: before the first session (nothing to draw
   from — point at Record / Add notes), and after one whose best-effort focus run failed (sessions
   exist, so offer "Generate my focus" — otherwise that state would be a dead end). */

type Props = {
    focus: FocusSnapshot | null;
    has_sessions: boolean;
    loading: boolean;
    error: string | null;
    on_reload: () => void;
    on_regenerate: () => void;
    regenerating: boolean;
    regenerate_error: string | null;
};

export const FocusHero = ({ focus, has_sessions, loading, error, on_reload, on_regenerate, regenerating, regenerate_error }: Props) => {
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
    if (!focus && has_sessions) {
        return (
            <div className="flex flex-col gap-3">
                <EmptyState
                    title="No focus yet"
                    body="Your sessions are in, but the focus has not been generated. Generate it now to see what to concentrate on."
                    action={
                        <Button variant="primary" onClick={on_regenerate} disabled={regenerating}>
                            {regenerating ? 'Generating…' : 'Generate my focus'}
                        </Button>
                    }
                />
                {regenerate_error && <ErrorState message={regenerate_error} />}
            </div>
        );
    }
    if (!focus) {
        return (
            <EmptyState
                title="Your focus will appear here"
                body="After your first session, this shows what to concentrate on right now, drawn from everything you and David have covered. Add a session to get started."
                action={
                    <div className="flex flex-wrap justify-center gap-2">
                        <ButtonLink to={paths.record} variant="primary">
                            Record a session
                        </ButtonLink>
                        <ButtonLink to={paths.upload_notes}>Add notes</ButtonLink>
                    </div>
                }
            />
        );
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
