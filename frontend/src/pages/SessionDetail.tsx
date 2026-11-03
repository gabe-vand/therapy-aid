import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Collapsible } from '@/components/sessions/Collapsible';
import { ProblemUpdates } from '@/components/sessions/ProblemUpdates';
import { ProcessingCard } from '@/components/sessions/ProcessingCard';
import { SessionHeader } from '@/components/sessions/SessionHeader';
import { SummaryBody } from '@/components/sessions/SummaryBody';
import { Button } from '@/components/ui/Button';
import { Loading, Skeleton } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/States';
import { useSession } from '@/services/hooks/use-session';
import { paths } from '@/services/paths';

/* One session. While it is processing it shows the stepper (the hook polls every 3s); failed shows
   the reason and Retry; ready shows the summary, problem updates and the collapsible source text.
   Title and date are editable; Delete asks first and returns to the list. */
export default function SessionDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const session_id = Number(id);
    const { session, loading, error, reload, busy, action_error, save, retry, remove } = useSession(Number.isInteger(session_id) ? session_id : null);
    const [confirming, set_confirming] = useState(false);

    const delete_session = async () => {
        if (await remove()) navigate(paths.sessions, { replace: true });
        else set_confirming(false);
    };

    const back = (
        <Link to={paths.sessions} className="ta-muted mb-4 inline-block text-sm font-medium hover:underline">
            ← Sessions
        </Link>
    );

    if (loading && !session) {
        return (
            <>
                {back}
                <Loading label="Loading session…">
                    <Skeleton height={34} className="mb-3 w-3/4" />
                    <Skeleton height={16} className="mb-8 w-1/3" />
                    <Skeleton height={14} lines={5} />
                </Loading>
            </>
        );
    }
    if (!session) {
        return (
            <>
                {back}
                <ErrorState message={error ?? 'This session could not be found.'} on_retry={reload} />
            </>
        );
    }

    const ready = session.status === 'ready';
    return (
        <>
            {back}
            <SessionHeader session={session} saving={busy} on_save={save} />
            {action_error && (
                <div className="mb-4">
                    <ErrorState message={action_error} />
                </div>
            )}

            <div className="flex flex-col gap-4">
                {!ready && <ProcessingCard session={session} busy={busy} on_retry={() => void retry()} />}
                {ready && session.summary && <SummaryBody summary={session.summary} />}
                {ready && !session.summary && <ErrorState message="This session finished without a summary. You can delete it and add it again." />}
                <ProblemUpdates updates={session.problem_updates} />
                {session.transcript && <Collapsible title="Transcript" text={session.transcript} />}
                {session.notes && <Collapsible title="Notes as written" text={session.notes} />}
            </div>

            <div className="mt-10 flex justify-center">
                <Button variant="ghost" onClick={() => set_confirming(true)} disabled={busy} style={{ color: 'var(--danger)' }}>
                    Delete session
                </Button>
            </div>
            <ConfirmDialog
                open={confirming}
                title="Delete this session?"
                body="The summary, transcript and any recording are removed for good. Progress notes it added to your problems stay."
                confirm_label="Delete"
                busy={busy}
                on_confirm={() => void delete_session()}
                on_cancel={() => set_confirming(false)}
            />
        </>
    );
}
