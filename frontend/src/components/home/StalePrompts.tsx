import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Problem } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/States';
import { elapsed_phrase } from '@/services/dates';
import { paths } from '@/services/paths';

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
        <section aria-labelledby="stale-title" className="flex flex-col gap-3">
            <h2 id="stale-title" className="text-lg font-semibold">
                Still relevant?
            </h2>
            {action_error && <ErrorState message={action_error} />}
            {problems.map((p) => {
                const busy = busy_id === p.id;
                return (
                    <Card key={p.id} as="article" className="flex flex-col gap-3" style={{ background: 'var(--warn-soft)', borderColor: 'transparent' }}>
                        <p className="leading-relaxed">
                            You haven’t talked about{' '}
                            <Link to={paths.problem(p.id)} className="font-semibold underline underline-offset-2">
                                {p.title}
                            </Link>{' '}
                            in {elapsed_phrase(last_touched(p))}. Still relevant?
                        </p>
                        <div className="flex gap-2">
                            <Button size="sm" variant="primary" onClick={() => on_keep(p.id)} disabled={busy}>
                                Keep
                            </Button>
                            <Button size="sm" onClick={() => set_discarding(p)} disabled={busy}>
                                Discard
                            </Button>
                        </div>
                    </Card>
                );
            })}
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
