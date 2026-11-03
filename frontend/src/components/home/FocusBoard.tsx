import { RefreshCw, Sparkles } from 'lucide-react';
import type { DashboardThread, FocusSnapshot } from '@therapy-aid/shared';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, Loading, Skeleton } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { relative_time } from '@/services/dates';
import { paths } from '@/services/paths';
import { FocusRow } from './FocusRow';
import { week_of } from './week';
import './home.css';
import './home-focus.css';

/* Home's front door: what to focus on right now. One headline sentence, then each focus item as a
   row of the "This week" check-in board (tick the days you did the action). Refresh regenerates the
   focus from the whole picture. With no focus there are two empty states: before the first session
   (nothing to draw from — point at Record / Add notes) and after one whose best-effort focus run
   failed (sessions exist, so offer "Generate my focus" rather than a dead end). `has_sessions` is
   null while the dashboard that knows is still loading. */

type Props = {
    focus: FocusSnapshot | null;
    has_sessions: boolean | null;
    threads: DashboardThread[];
    loading: boolean;
    error: string | null;
    on_reload: () => void;
    on_regenerate: () => void;
    regenerating: boolean;
    regenerate_error: string | null;
    on_toggle: (item_index: number, day: string) => void;
    checkin_error: string | null;
};

const Skeletons = () => (
    <Loading label="Loading your focus…">
        <Card>
            <Skeleton height={14} className="mb-4 w-32" />
            <Skeleton height={26} className="mb-6 w-4/5" />
            <Skeleton height={52} className="mb-3" />
            <Skeleton height={52} />
        </Card>
    </Loading>
);

export const FocusBoard = (props: Props) => {
    const { focus, has_sessions, loading, error, regenerating, regenerate_error } = props;
    if ((loading && !focus) || (!focus && !error && has_sessions === null)) return <Skeletons />;
    if (error && !focus) return <ErrorState message={error} on_retry={props.on_reload} />;
    if (!focus && has_sessions) {
        const action = (
            <Button variant="primary" onClick={props.on_regenerate} disabled={regenerating}>
                <Sparkles aria-hidden />
                {regenerating ? 'Generating…' : 'Generate my focus'}
            </Button>
        );
        return (
            <Card className="ta-focus ta-focus--empty">
                <EmptyState title="No focus yet" body="Your sessions are in, but the focus has not been generated yet. Generate it to see what to work on this week." action={action} />
                {regenerate_error && <ErrorState message={regenerate_error} />}
            </Card>
        );
    }
    if (!focus) {
        const actions = (
            <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink to={paths.record} variant="primary">
                    Record a session
                </ButtonLink>
                <ButtonLink to={paths.upload_notes}>Add notes</ButtonLink>
            </div>
        );
        return (
            <Card className="ta-focus ta-focus--empty">
                <EmptyState title="Your focus will appear here" body="After your first session this shows what to work on this week, drawn from everything you and David have covered." action={actions} />
            </Card>
        );
    }

    const week = week_of();
    const titles = new Map(props.threads.map((t) => [t.id, t.title]));
    const done_for = (index: number) => new Set(focus.checkins.filter((c) => c.item_index === index).map((c) => c.day));

    return (
        <Card as="section" aria-labelledby="focus-headline" className="ta-focus">
            <div className="ta-focus__top">
                <p className="ta-eyebrow">Your focus</p>
                <div className="ta-focus__meta">
                    <span>Updated {relative_time(focus.created_at)}</span>
                    <span aria-hidden>·</span>
                    <Button size="sm" variant="ghost" onClick={props.on_regenerate} disabled={regenerating}>
                        <RefreshCw aria-hidden className={regenerating ? 'ta-spin' : undefined} />
                        {regenerating ? 'Refreshing…' : 'Refresh'}
                    </Button>
                </div>
            </div>
            <h2 id="focus-headline" className="ta-focus__headline">
                {focus.headline}
            </h2>
            {regenerate_error && <ErrorState message={regenerate_error} />}
            <p className="ta-eyebrow ta-focus__board-label">This week</p>
            <ul className="ta-focus__board" aria-busy={regenerating}>
                {focus.items.map((item, i) => (
                    <FocusRow key={`${focus.id}-${i}`} item={item} week={week} done={done_for(i)} problem_title={item.problem_id === null ? null : (titles.get(item.problem_id) ?? null)} on_toggle={(day) => props.on_toggle(i, day)} />
                ))}
            </ul>
            {props.checkin_error && <ErrorState message={props.checkin_error} />}
        </Card>
    );
};
