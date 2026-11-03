import { Mic } from 'lucide-react';
import { SessionTimeline } from '@/components/sessions/SessionTimeline';
import { rhythm_sentence } from '@/components/sessions/rhythm';
import { ButtonLink } from '@/components/ui/Button';
import { Loading, Skeleton } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
import { useDashboard } from '@/services/hooks/use-dashboard';
import { useSessions } from '@/services/hooks/use-sessions';
import { paths } from '@/services/paths';

/* Every session, newest first, as a timeline grouped by month. The subtitle is a live sentence
   about the rhythm of therapy (how many, since when, how often, how long ago) — the list drives
   it, the dashboard adds the typical gap when it answers, and a dashboard failure just leaves that
   part out. The two ways to add a session sit in the header, one tap from the list. */
export default function Sessions() {
    const { sessions, loading, error, reload } = useSessions();
    const { dashboard } = useDashboard();

    const actions = (
        <>
            <ButtonLink to={paths.upload_notes}>Add notes</ButtonLink>
            <ButtonLink to={paths.record} variant="primary">
                <Mic size={15} aria-hidden />
                Record
            </ButtonLink>
        </>
    );

    const subtitle = rhythm_sentence({ sessions, typical_gap_days: dashboard?.sessions.typical_gap_days ?? null });

    return (
        <Page width="wide">
            <PageHeader title="Sessions" subtitle={subtitle} actions={actions} />

            {loading && sessions.length === 0 && (
                <Loading label="Loading sessions…">
                    <div className="flex flex-col gap-2 pl-7">
                        <Skeleton height={12} className="mb-1 w-28" />
                        <Skeleton height={56} />
                        <Skeleton height={56} />
                        <Skeleton height={56} />
                    </div>
                </Loading>
            )}
            {!loading && error && <ErrorState message={error} on_retry={reload} />}
            {!loading && !error && sessions.length === 0 && (
                <EmptyState
                    icon={<Mic size={24} />}
                    title="No sessions yet"
                    body="Record your next session as it happens, or paste in notes from an earlier one. Each becomes a summary, advice from David, and updates to your problems."
                    action={
                        <div className="flex flex-wrap justify-center gap-2">
                            <ButtonLink to={paths.record} variant="primary">
                                Record a session
                            </ButtonLink>
                            <ButtonLink to={paths.upload_notes}>Add notes</ButtonLink>
                        </div>
                    }
                />
            )}

            {sessions.length > 0 && <SessionTimeline sessions={sessions} />}
        </Page>
    );
}
