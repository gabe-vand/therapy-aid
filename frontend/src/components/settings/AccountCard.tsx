import type { Me } from '@therapy-aid/shared';
import { Card, Skeleton } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/States';

/* Who the API thinks is signed in (the Tailscale login). Mostly a sanity check: if this shows
   an error, the tailnet header is not reaching the server and nothing else will work either. */
export const AccountCard = ({ me, loading, error, on_reload }: { me: Me | null; loading: boolean; error: string | null; on_reload: () => void }) => (
    <Card aria-labelledby="account-title">
        <h2 id="account-title" className="text-lg font-semibold">
            Account
        </h2>
        <div className="mt-3">
            {loading ? (
                <div role="status" aria-label="Loading account…">
                    <Skeleton height={22} className="max-w-[260px]" />
                </div>
            ) : error !== null ? (
                <ErrorState message={error} on_retry={on_reload} />
            ) : (
                <p className="text-[15px]">
                    <span className="ta-muted">Signed in as </span>
                    <strong className="font-semibold">{me?.login}</strong>
                </p>
            )}
        </div>
    </Card>
);
