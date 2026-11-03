import type { SessionListItem } from '@therapy-aid/shared';
import { SessionRow } from '@/components/sessions/SessionRow';
import { ButtonLink } from '@/components/ui/Button';
import { Card, Loading, Skeleton } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/States';
import { paths } from '@/services/paths';

/* Home's "last session" card: the newest session as a tappable row (title, date, status) with a
   link on to the full list. Its own loading/error states, so a slow list never blanks Home. */

type Props = { session: SessionListItem | undefined; loading: boolean; error: string | null; on_retry: () => void };

export const LastSession = ({ session, loading, error, on_retry }: Props) => {
    let body;
    if (loading && !session) {
        body = (
            <Loading label="Loading last session…">
                <Skeleton height={44} />
            </Loading>
        );
    } else if (error && !session) {
        body = <ErrorState message={error} on_retry={on_retry} />;
    } else if (!session) {
        body = <p className="ta-muted px-5 py-4 text-[15px]">No sessions yet. Your most recent one shows up here.</p>;
    } else {
        body = <SessionRow session={session} />;
    }

    return (
        <section aria-labelledby="last-session-title" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 id="last-session-title" className="text-lg font-semibold">
                    Last session
                </h2>
                <ButtonLink to={paths.sessions} variant="ghost" size="sm">
                    All sessions
                </ButtonLink>
            </div>
            <Card padded={false} className="overflow-hidden">
                {body}
            </Card>
        </section>
    );
};
