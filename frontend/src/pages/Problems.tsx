import { useState } from 'react';
import type { Problem } from '@therapy-aid/shared';
import { NewProblemForm } from '@/components/problems/NewProblemForm';
import { ProblemCard } from '@/components/problems/ProblemCard';
import { Button } from '@/components/ui/Button';
import { Loading, Skeleton } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/States';
import { useProblems } from '@/services/hooks/use-problems';

/* The big-picture threads that persist across sessions. Active problems first (stale ones are
   flagged and ask "Still relevant?" with Keep / Discard), resolved ones collapsed underneath.
   Discard is destructive, so it goes through a ConfirmDialog; Keep is a one-tap review. */
export default function Problems() {
    const { problems, loading, error, reload, keep, discard, create, creating, busy_id, action_error } = useProblems();
    const [adding, set_adding] = useState(false);
    const [show_resolved, set_show_resolved] = useState(false);
    const [to_discard, set_to_discard] = useState<Problem | null>(null);

    const active = problems.filter((p) => p.status === 'active');
    const resolved = problems.filter((p) => p.status === 'resolved');

    const confirm_discard = async () => {
        if (!to_discard) return;
        await discard(to_discard.id);
        set_to_discard(null);
    };

    const new_button = (
        <Button variant="primary" onClick={() => set_adding(true)} disabled={adding}>
            + New problem
        </Button>
    );

    return (
        <>
            <PageHeader title="Problems" subtitle="The themes that keep coming up, and how they are moving." actions={new_button} />

            {adding && <NewProblemForm creating={creating} error={action_error} on_submit={create} on_cancel={() => set_adding(false)} />}
            {!adding && action_error && (
                <div className="mb-4">
                    <ErrorState message={action_error} />
                </div>
            )}

            {loading ? (
                <Loading label="Loading problems">
                    <div className="flex flex-col gap-3">
                        <Skeleton height={104} />
                        <Skeleton height={104} />
                        <Skeleton height={104} />
                    </div>
                </Loading>
            ) : error ? (
                <ErrorState message={error} on_retry={reload} />
            ) : (
                <>
                    {active.length === 0 ? (
                        <EmptyState title="No active problems" body="Problems appear on their own as your sessions are summarised, or you can add one yourself." action={!adding && new_button} />
                    ) : (
                        <ul className="flex list-none flex-col gap-3 p-0" aria-label="Active problems">
                            {active.map((p) => (
                                <li key={p.id}>
                                    <ProblemCard problem={p} busy={busy_id === p.id} on_keep={(x) => void keep(x.id)} on_discard={set_to_discard} />
                                </li>
                            ))}
                        </ul>
                    )}

                    {resolved.length > 0 && (
                        <section className="mt-8">
                            <button
                                type="button"
                                className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-left text-[15px] font-semibold"
                                aria-expanded={show_resolved}
                                aria-controls="resolved-problems"
                                onClick={() => set_show_resolved((v) => !v)}>
                                <span>Resolved ({resolved.length})</span>
                                <span aria-hidden className="ta-muted">
                                    {show_resolved ? '▲' : '▼'}
                                </span>
                            </button>
                            {show_resolved && (
                                <ul id="resolved-problems" className="mt-2 flex list-none flex-col gap-3 p-0">
                                    {resolved.map((p) => (
                                        <li key={p.id}>
                                            <ProblemCard problem={p} />
                                        </li>
                                    ))}
                                </ul>
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
        </>
    );
}
