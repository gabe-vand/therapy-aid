import { useMemo, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import type { Problem } from '@therapy-aid/shared';
import { NewProblemForm } from '@/components/problems/NewProblemForm';
import { ProblemRow } from '@/components/problems/ProblemRow';
import { problems_sentence } from '@/components/problems/summary';
import { Button } from '@/components/ui/Button';
import { Card, Loading, Skeleton } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
import '@/components/problems/problems-list.css';
import { useDashboard } from '@/services/hooks/use-dashboard';
import { useProblems } from '@/services/hooks/use-problems';

/* The big-picture threads that persist across sessions. Active problems first (stale ones are
   flagged with a chip and inline Keep / Discard), resolved ones in a disclosure underneath. Each
   active row also draws its session dots and journal mentions from the dashboard, joined by id —
   nothing extra shows while that loads, and a dashboard failure only loses the dots. The subtitle
   counts what is on the list. New problems are typed into a form at the top of the list.
   Discard is destructive, so it goes through a ConfirmDialog; Keep is a one-tap review. */

export default function Problems() {
    const { problems, loading, error, reload, keep, discard, create, creating, busy_id, action_error } = useProblems();
    const [adding, set_adding] = useState(false);
    const [show_resolved, set_show_resolved] = useState(false);
    const [to_discard, set_to_discard] = useState<Problem | null>(null);
    const { dashboard } = useDashboard();
    const threads = useMemo(() => new Map((dashboard?.threads ?? []).map((t) => [t.id, t])), [dashboard]);

    const active = problems.filter((p) => p.status === 'active');
    const resolved = problems.filter((p) => p.status === 'resolved');

    const confirm_discard = async () => {
        if (!to_discard) return;
        await discard(to_discard.id);
        set_to_discard(null);
    };

    const new_button = (
        <Button variant="primary" onClick={() => set_adding(true)} disabled={adding}>
            <Plus size={15} />
            New problem
        </Button>
    );

    return (
        <Page width="wide">
            <PageHeader title="Problems" subtitle={loading ? 'The themes that keep coming up, and how they are moving.' : problems_sentence(problems)} actions={new_button} />

            {!adding && action_error && (
                <div className="mb-4">
                    <ErrorState message={action_error} />
                </div>
            )}

            {loading ? (
                <Loading label="Loading problems">
                    <Card padded={false} className="flex flex-col gap-3 p-4">
                        <Skeleton height={40} />
                        <Skeleton height={40} />
                        <Skeleton height={40} />
                    </Card>
                </Loading>
            ) : error ? (
                <ErrorState message={error} on_retry={reload} />
            ) : (
                <>
                    {active.length === 0 && !adding ? (
                        <EmptyState title="No active problems" body="Problems appear on their own as your sessions are summarised, or you can add one yourself." action={new_button} />
                    ) : (
                        <Card padded={false} className="overflow-hidden">
                            {adding && <NewProblemForm creating={creating} error={action_error} on_submit={create} on_cancel={() => set_adding(false)} />}
                            {active.length > 0 && (
                                <ul className="ta-prows" aria-label="Active problems">
                                    {active.map((p) => (
                                        <li key={p.id}>
                                            <ProblemRow problem={p} thread={threads.get(p.id)} busy={busy_id === p.id} on_keep={(x) => void keep(x.id)} on_discard={set_to_discard} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    )}

                    {resolved.length > 0 && (
                        <section>
                            <button type="button" className="ta-disclosure" aria-expanded={show_resolved} aria-controls="resolved-problems" onClick={() => set_show_resolved((v) => !v)}>
                                <ChevronRight aria-hidden />
                                <span>Resolved ({resolved.length})</span>
                            </button>
                            {show_resolved && (
                                <Card padded={false} className="mt-2">
                                    <ul id="resolved-problems" className="ta-prows">
                                        {resolved.map((p) => (
                                            <li key={p.id}>
                                                <ProblemRow problem={p} />
                                            </li>
                                        ))}
                                    </ul>
                                </Card>
                            )}
                        </section>
                    )}
                </>
            )}

            <ConfirmDialog
                open={to_discard !== null}
                title="Discard this problem?"
                body={to_discard && `"${to_discard.title}" will be hidden from your list. Its notes are kept.`}
                confirm_label="Discard"
                busy={busy_id !== null}
                on_confirm={() => void confirm_discard()}
                on_cancel={() => set_to_discard(null)}
            />
        </Page>
    );
}
