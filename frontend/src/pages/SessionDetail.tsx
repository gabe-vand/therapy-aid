import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Collapsible } from '@/components/sessions/Collapsible';
import { ProblemUpdates } from '@/components/sessions/ProblemUpdates';
import { ProcessingCard } from '@/components/sessions/ProcessingCard';
import { SessionHeader } from '@/components/sessions/SessionHeader';
import { SessionNav } from '@/components/sessions/SessionNav';
import { SummaryBody, summary_sections } from '@/components/sessions/SummaryBody';
import { Button } from '@/components/ui/Button';
import { Loading, Skeleton } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BackLink, ErrorState } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
import { useSession } from '@/services/hooks/use-session';
import { paths } from '@/services/paths';

/* One session, as anchored sections (Overview, Key points, What David suggested, Problems this
   session touched) with a sticky mini-nav rail on wide screens. While it is processing it shows the stepper (the hook polls every 3s); failed shows
   the reason and Retry — plus the summary when it was already saved (a failure in the problem
   step must not hide a summary that was paid for); ready shows the summary, problem updates and
   the collapsible source text. An unfinished recording can be finished from here. Title and date
   are editable; Delete asks first and returns to the list. */
export default function SessionDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const session_id = Number(id);
    const { session, loading, error, reload, busy, action_error, save, retry, finish, remove } = useSession(Number.isInteger(session_id) ? session_id : null);
    const [confirming, set_confirming] = useState(false);

    const delete_session = async () => {
        if (await remove()) navigate(paths.sessions, { replace: true });
        else set_confirming(false);
    };

    const back = <BackLink to={paths.sessions} label="Sessions" />;

    if (loading && !session) {
        return (
            <Page width="reading">
                {back}
                <Loading label="Loading session…">
                    <Skeleton height={34} className="mb-3 w-3/4" />
                    <Skeleton height={16} className="mb-8 w-1/3" />
                    <Skeleton height={14} lines={5} />
                </Loading>
            </Page>
        );
    }
    if (!session) {
        return (
            <Page width="reading">
                {back}
                <ErrorState message={error ?? 'This session could not be found.'} on_retry={reload} />
            </Page>
        );
    }

    const ready = session.status === 'ready';
    const show_summary = (ready || session.status === 'failed') && !!session.summary;
    const sections = [...(show_summary ? summary_sections(session.summary!) : []), ...(session.problem_updates.length > 0 ? [{ id: 'problems', label: 'Problems' }] : [])];
    return (
        <Page width="reading" className="ta-sdetail">
            <div className="ta-sdetail__grid">
                <div className="min-w-0">
                    {back}
                    <SessionHeader session={session} saving={busy} on_save={save} />
                    {action_error && (
                        <div className="mb-4">
                            <ErrorState message={action_error} />
                        </div>
                    )}

                    <div className="ta-sdetail__body">
                        {!ready && <ProcessingCard session={session} busy={busy} on_retry={() => void retry()} on_finish={() => void finish()} />}
                        {show_summary && <SummaryBody summary={session.summary!} />}
                        {ready && !session.summary && <ErrorState message="This session finished without a summary. You can delete it and add it again." />}
                        <ProblemUpdates updates={session.problem_updates} />
                        {session.transcript && <Collapsible title="Transcript" text={session.transcript} />}
                        {session.notes && <Collapsible title="Notes as written" text={session.notes} />}
                    </div>
                    <div className="mt-12">
                        <Button variant="ghost" onClick={() => set_confirming(true)} disabled={busy} className="ta-btn-danger-text">
                            Delete session
                        </Button>
                    </div>
                </div>
                <SessionNav sections={sections} />
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
        </Page>
    );
}
