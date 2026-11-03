import { AlertTriangle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddNoteForm } from '@/components/problems/AddNoteForm';
import { EditableText } from '@/components/problems/EditableText';
import { JournalMentions } from '@/components/problems/JournalMentions';
import { ProblemFacts } from '@/components/problems/ProblemFacts';
import '@/components/problems/problems-detail.css';
import { ProblemTimeline } from '@/components/problems/ProblemTimeline';
import { StatusActions } from '@/components/problems/StatusActions';
import { Button } from '@/components/ui/Button';
import { Chip, Loading, Skeleton } from '@/components/ui/Card';
import { BackLink, ErrorState } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
import { useProblem } from '@/services/hooks/use-problem';
import { paths } from '@/services/paths';

/* One problem: an inline-editable title with its status chip and Resolve / Reopen / Discard (each
   confirmed) under it, a facts strip (opened, last discussed, notes, journal mentions), the
   editable description, a Keep prompt when it has gone stale, then the timeline rail — the
   add-note form at its top — and the journal paragraphs that mentioned it. A discard sends you
   back to the list, since the problem is no longer on it. */
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
                    <Skeleton height={32} className="mb-3 w-3/4" />
                    <Skeleton height={12} className="mb-8 w-1/2" />
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

    return (
        <Page width="reading">
            {back}
            <EditableText value={problem.title} label="title" required disabled={busy} on_save={(title) => patch({ title })} />
            <div className="ta-pbar">
                <div className="ta-pbar__chips">
                    {problem.status === 'active' && <Chip tone="accent">Active</Chip>}
                    {problem.status === 'resolved' && <Chip tone="ok">Resolved</Chip>}
                    {problem.status === 'discarded' && <Chip tone="danger">Discarded</Chip>}
                    {problem.is_stale && <Chip tone="warn">Stale</Chip>}
                </div>
                <StatusActions problem={problem} busy={busy} on_status={on_status} />
            </div>
            <ProblemFacts problem={problem} />

            <div className="mt-6">
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

            <section aria-labelledby="timeline-title" className="ta-pdetail__section">
                <h2 id="timeline-title" className="ta-section-label">
                    Timeline
                </h2>
                <ProblemTimeline updates={problem.updates} compose={<AddNoteForm busy={busy} on_add={add_note} />} />
            </section>

            <JournalMentions mentions={problem.journal_mentions} />
        </Page>
    );
}
