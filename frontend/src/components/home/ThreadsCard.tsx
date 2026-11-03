import { useState } from 'react';
import type { Dashboard, DashboardThread } from '@therapy-aid/shared';
import { Card, Loading, Skeleton } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/States';
import { format_date } from '@/services/dates';
import { ThreadRow } from './ThreadRow';
import './home-threads.css';

/* Home's Threads block: every active problem against the last few sessions as a dot grid, so
   "what keeps coming up, and what has gone quiet" is one glance instead of a paragraph. Stale
   problems get Keep / Discard inline (Discard asks first). Loads and fails on its own. */

type Props = { dashboard: Dashboard | null; loading: boolean; error: string | null; on_retry: () => void; busy_id: number | null; action_error: string | null; on_keep: (id: number) => void; on_discard: (id: number) => Promise<unknown> };

const short = (iso: string) => format_date(iso, { year: false });

export const ThreadsCard = ({ dashboard, loading, error, on_retry, busy_id, action_error, on_keep, on_discard }: Props) => {
    const [discarding, set_discarding] = useState<DashboardThread | null>(null);
    const axis = dashboard?.sessions.axis ?? [];
    const threads = dashboard?.threads ?? [];
    const range = axis.length > 1 ? `${short(axis[0]!.occurred_at)} – ${short(axis[axis.length - 1]!.occurred_at)}` : axis[0] ? short(axis[0].occurred_at) : '';
    const dot_titles = axis.map((s) => `${short(s.occurred_at)}${s.title ? ` · ${s.title}` : ''}`);

    let body;
    if (loading && !dashboard) {
        body = (
            <Loading label="Loading threads…">
                <div className="flex flex-col gap-4 p-5">
                    <Skeleton height={18} />
                    <Skeleton height={18} />
                    <Skeleton height={18} className="w-2/3" />
                </div>
            </Loading>
        );
    } else if (error && !dashboard) {
        body = (
            <div className="p-4">
                <ErrorState message={error} on_retry={on_retry} />
            </div>
        );
    } else if (threads.length === 0) {
        body = <p className="ta-threads__empty">Problems appear as sessions are summarised.</p>;
    } else {
        body = (
            <ul className="ta-threads">
                {threads.map((t) => (
                    <ThreadRow key={t.id} thread={t} dot_titles={dot_titles} busy={busy_id === t.id} on_keep={() => on_keep(t.id)} on_discard={() => set_discarding(t)} />
                ))}
            </ul>
        );
    }

    const confirm_discard = async () => {
        if (discarding) await on_discard(discarding.id);
        set_discarding(null);
    };

    return (
        <section aria-labelledby="threads-title" className="ta-home-block">
            <div className="ta-block-head">
                <h2 id="threads-title" className="ta-eyebrow">
                    Threads
                </h2>
                {axis.length > 0 && (
                    <span className="ta-block-head__meta">
                        last {axis.length} session{axis.length === 1 ? '' : 's'} · {range}
                    </span>
                )}
            </div>
            <Card padded={false} className="overflow-hidden">
                {body}
            </Card>
            {action_error && <ErrorState message={action_error} />}
            <ConfirmDialog
                open={discarding !== null}
                title="Discard this problem?"
                body={discarding ? `“${discarding.title}” will be hidden from your problems and from future focus suggestions.` : undefined}
                confirm_label="Discard"
                busy={busy_id !== null}
                on_confirm={() => void confirm_discard()}
                on_cancel={() => set_discarding(null)}
            />
        </section>
    );
};
