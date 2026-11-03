import { useState } from 'react';
import type { ProblemDetail, ProblemStatus } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

/* Resolve / Reopen / Discard for a problem. Resolve and Discard change what Gabe sees on his list,
   so each asks first (ConfirmDialog); Reopen is harmless and happens at once. The page owns the
   mutation (on_status resolves true on success) and decides what happens next (e.g. leave the
   page after a discard). */

type Props = { problem: Pick<ProblemDetail, 'status' | 'title'>; busy: boolean; on_status: (status: ProblemStatus) => Promise<boolean> };

export function StatusActions({ problem, busy, on_status }: Props) {
    const [asking, set_asking] = useState<'resolved' | 'discarded' | null>(null);

    const confirm = async () => {
        if (!asking) return;
        await on_status(asking);
        set_asking(null); // success or not: on failure the page shows action_error, so the dialog must not stick
    };

    return (
        <>
            <div className="ta-actions-row">
                {problem.status === 'active' ? (
                    <>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => set_asking('resolved')}>
                            Resolve
                        </Button>
                        <Button size="sm" variant="ghost" className="ta-btn-danger-ghost" disabled={busy} onClick={() => set_asking('discarded')}>
                            Discard
                        </Button>
                    </>
                ) : (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void on_status('active')}>
                        Reopen
                    </Button>
                )}
            </div>
            <ConfirmDialog
                open={asking !== null}
                tone={asking === 'discarded' ? 'danger' : 'primary'}
                title={asking === 'discarded' ? 'Discard this problem?' : 'Mark this problem resolved?'}
                body={asking === 'discarded' ? `"${problem.title}" will be hidden from your list. Its notes are kept.` : `"${problem.title}" moves to Resolved. You can reopen it any time.`}
                confirm_label={asking === 'discarded' ? 'Discard' : 'Resolve'}
                busy={busy}
                on_confirm={() => void confirm()}
                on_cancel={() => set_asking(null)}
            />
        </>
    );
}
