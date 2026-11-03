import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Problem } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/States';
import { elapsed_phrase } from '@/services/dates';
import { paths } from '@/services/paths';
import './home.css';

/* "Still relevant?" cards for problems that have gone 30 days untouched. Keep resets the clock;
   Discard retires the problem, so it asks first. Renders nothing when there is nothing to ask
   (and while loading or on error — these are a nudge, not something Home should block on). */

type Props = { problems: Problem[]; busy_id: number | null; action_error: string | null; on_keep: (id: number) => void; on_discard: (id: number) => Promise<boolean> };

const last_touched = (p: Problem) =>
    [p.last_discussed_at, p.last_reviewed_at, p.created_at]
        .filter((d): d is string => !!d)
        .sort()
        .pop() ?? p.created_at;

export const StalePrompts = ({ problems, busy_id, action_error, on_keep, on_discard }: Props) => {
    const [discarding, set_discarding] = useState<Problem | null>(null);
    if (problems.length === 0 && !action_error) return null;

    const confirm_discard = async () => {
        if (discarding) await on_discard(discarding.id);
        set_discarding(null);
    };

    return (
        <section aria-labelledby="stale-title">
            <h2 id="stale-title" className="ta-section-title">
                Still relevant?
            </h2>
            {action_error && <ErrorState message={action_error} />}
            {problems.length > 0 && (
                <Card padded={false}>
                    <ul className="ta-quiet-list">
                        {problems.map((p) => {
                            const busy = busy_id === p.id;
                            return (
                                <li key={p.id}>
                                    <p>
                                        You haven’t talked about{' '}
                                        <Link to={paths.problem(p.id)} className="underline underline-offset-2">
                                            {p.title}
                                        </Link>{' '}
                                        in {elapsed_phrase(last_touched(p))}. Still relevant?
                                    </p>
                                    <div className="ta-quiet-list__actions">
                                        <Button size="sm" onClick={() => on_keep(p.id)} disabled={busy}>
                                            Keep
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => set_discarding(p)} disabled={busy}>
                                            Discard
                                        </Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}
            <ConfirmDialog
                open={discarding !== null}
                title="Discard this problem?"
                body={discarding ? `“${discarding.title}” will be hidden from your problems and from future focus suggestions.` : undefined}
                confirm_label="Discard"
                busy={busy_id !== null}
                on_confirm={() => void confirm_discard()}
                on_cancel={() => set_discarding(null)}
            />
        </section>
    );
};
