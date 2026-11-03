import { AlertTriangle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddNoteForm } from '@/components/problems/AddNoteForm';
import { EditableText } from '@/components/problems/EditableText';
import '@/components/problems/problems-detail.css';
import { ProblemTimeline } from '@/components/problems/ProblemTimeline';
import { StatusActions } from '@/components/problems/StatusActions';
import { Button } from '@/components/ui/Button';
import { Card, Chip, Loading, Skeleton } from '@/components/ui/Card';
import { BackLink, ErrorState } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
import { format_date, relative_time } from '@/services/dates';
import { useProblem } from '@/services/hooks/use-problem';
import { paths } from '@/services/paths';

/* One problem: inline-editable title and description, Resolve / Reopen / Discard (each confirmed),
   a Keep prompt when it has gone stale, a form for manual notes, and the timeline of everything
   said about it. A discard sends you back to the list, since the problem is no longer on it. */
export default function ProblemDetail() {
    const { id } = useParams();
    const problem_id = id && /^\d+$/.test(id) ? Number(id) : null;
    const navigate = useNavigate();
    const { problem, loading, error, reload, busy, action_error, patch, keep, add_note } = useProblem(problem_id);

    const back = <BackLink to={paths.problems} label="Problems" />;

    if (loading) {
        return (
            <Page width="reading">
                {back}
                <Loading label="Loading problem">
                    <Skeleton height={36} className="mb-4" />
                    <Skeleton lines={3} />
                </Loading>
            </Page>
        );
    }
    if (error || !problem) {
        return (
            <Page width="reading">
                {back}
                <ErrorState message={error ?? 'Problem not found.'} on_retry={problem_id === null ? undefined : reload} />
            </Page>
        );
    }

    const on_status = async (status: 'active' | 'resolved' | 'discarded') => {
        const ok = await patch({ status });
        if (ok && status === 'discarded') navigate(paths.problems);
        return ok;
    };

    const count = problem.update_count;
    return (
        <Page width="reading">
            {back}
            <div className="mb-3 mt-1 flex flex-wrap items-center gap-2">
                {problem.status === 'resolved' && <Chip tone="ok">Resolved</Chip>}
                {problem.status === 'discarded' && <Chip tone="danger">Discarded</Chip>}
                {problem.is_stale && <Chip tone="warn">Stale</Chip>}
            </div>

            <EditableText value={problem.title} label="title" required disabled={busy} on_save={(title) => patch({ title })} />
            <p className="ta-muted mt-2 text-[13px]" style={{ paddingInline: 0 }}>
                Opened {format_date(problem.created_at)} · {problem.last_discussed_at ? `last discussed ${relative_time(problem.last_discussed_at)}` : 'not discussed yet'} · {count} {count === 1 ? 'update' : 'updates'}
            </p>

            <div className="mt-4">
                <EditableText value={problem.description} label="description" multiline placeholder="No description yet. Add a sentence so future you remembers what this is." disabled={busy} on_save={(description) => patch({ description })} />
            </div>

            {action_error && (
                <div className="mt-4">
                    <ErrorState message={action_error} />
                </div>
            )}

            {problem.is_stale && (
                <div className="ta-stale mt-5">
                    <AlertTriangle size={18} aria-hidden />
                    <p>You haven&apos;t touched this in a while. Still relevant?</p>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void keep()}>
                        Yes, keep it
                    </Button>
                </div>
            )}

            <div className="mt-5">
                <StatusActions problem={problem} busy={busy} on_status={on_status} />
            </div>

            <Card as="section" className="mt-8">
                <AddNoteForm busy={busy} on_add={add_note} />
            </Card>

            <h2 className="ta-section-label">Timeline</h2>
            <ProblemTimeline updates={problem.updates} />
        </Page>
    );
}
