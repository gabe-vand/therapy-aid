import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import type { FocusSnapshot } from '@therapy-aid/shared';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, Loading, Skeleton } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { relative_time } from '@/services/dates';
import { paths } from '@/services/paths';
import './home.css';

/* The banner at the top of Home: what to focus on right now. A one-line headline and up to three
   cards (what, why, and the one thing to do this week). Refresh regenerates it from the whole
   picture. With no focus there are two empty states: before the first session (nothing to draw
   from — point at Record / Add notes), and after one whose best-effort focus run failed (sessions
   exist, so offer "Generate my focus" — otherwise that state would be a dead end). */

type Props = { focus: FocusSnapshot | null; has_sessions: boolean; loading: boolean; error: string | null; on_reload: () => void; on_regenerate: () => void; regenerating: boolean; regenerate_error: string | null };

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
        <section aria-labelledby="focus-headline" className="ta-focus">
            <div className="ta-focus__top">
                <p className="ta-eyebrow">Your focus right now</p>
                <div className="ta-focus__meta">
                    <span>Updated {relative_time(focus.created_at)}</span>
                    <Button size="sm" variant="ghost" onClick={on_regenerate} disabled={regenerating}>
                        <RefreshCw size={14} aria-hidden />
                        {regenerating ? 'Refreshing…' : 'Refresh'}
                    </Button>
                </div>
            </div>
            <h2 id="focus-headline" className="ta-focus__headline">
                {focus.headline}
            </h2>
            {regenerate_error && <ErrorState message={regenerate_error} />}
            <ul className="ta-focus__grid" aria-busy={regenerating}>
                {focus.items.map((item) => (
                    <li key={item.title}>
                        <Card as="article" className="ta-focus__card" style={{ opacity: regenerating ? 0.6 : 1 }}>
                            <h3>{item.title}</h3>
                            <p className="ta-focus__why">{item.why}</p>
                            <p className="ta-focus__week">
                                <span>This week</span>
                                {item.action}
                            </p>
                            {item.problem_id !== null && (
                                <Link to={paths.problem(item.problem_id)} className="ta-focus__link">
                                    See the related problem
                                    <ArrowRight size={14} aria-hidden />
                                </Link>
                            )}
                        </Card>
                    </li>
                ))}
            </ul>
        </section>
    );
};
