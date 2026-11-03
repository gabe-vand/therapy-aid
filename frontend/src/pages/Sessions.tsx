import { Mic } from 'lucide-react';
import type { SessionListItem } from '@therapy-aid/shared';
import { SessionRow } from '@/components/sessions/SessionRow';
import { ButtonLink } from '@/components/ui/Button';
import { Card, Loading, Skeleton } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
import { format_month } from '@/services/dates';
import { useSessions } from '@/services/hooks/use-sessions';
import { paths } from '@/services/paths';

/* Every session, newest first, grouped under month headings. Each row opens SessionDetail; the two
   ways to add one (record live, paste notes) sit in the header so they are one tap from the list. */

// The list arrives newest-first, so consecutive rows with the same month share a group.
const group_by_month = (sessions: SessionListItem[]) => {
    const groups: { month: string; items: SessionListItem[] }[] = [];
    for (const s of sessions) {
        const month = format_month(s.occurred_at);
        const last = groups[groups.length - 1];
        if (last && last.month === month) last.items.push(s);
        else groups.push({ month, items: [s] });
    }
    return groups;
};

export default function Sessions() {
    const { sessions, loading, error, reload } = useSessions();

    const actions = (
        <>
            <ButtonLink to={paths.upload_notes}>Add notes</ButtonLink>
            <ButtonLink to={paths.record} variant="primary">
                <Mic size={15} aria-hidden />
                Record
            </ButtonLink>
        </>
    );

    return (
        <Page width="wide">
            <PageHeader title="Sessions" subtitle="Every conversation with David, in one place." actions={actions} />

            {loading && sessions.length === 0 && (
                <Loading label="Loading sessions…">
                    <Skeleton height={56} className="mb-2" />
                    <Skeleton height={56} className="mb-2" />
                    <Skeleton height={56} />
                </Loading>
            )}
            {!loading && error && <ErrorState message={error} on_retry={reload} />}
            {!loading && !error && sessions.length === 0 && (
                <EmptyState
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

            <div className="flex flex-col gap-8">
                {group_by_month(sessions).map((group) => (
                    <section key={group.month} aria-label={group.month}>
                        <h2 className="ta-month-label">{group.month}</h2>
                        <Card padded={false} className="overflow-hidden">
                            {group.items.map((s) => (
                                <SessionRow key={s.id} session={s} />
                            ))}
                        </Card>
                    </section>
                ))}
            </div>
        </Page>
    );
}
