import type { Session } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProcessingStepper } from './ProcessingStepper';

/* Shown in place of the summary while the pipeline runs (stepper + reassurance that leaving is
   fine) or after it failed (the server's reason in plain words + Retry, which resumes at the step
   that broke — a transcript that already exists is not re-bought). */

type Props = { session: Session; busy: boolean; on_retry: () => void };

export const ProcessingCard = ({ session, busy, on_retry }: Props) => {
    const failed = session.status === 'failed';
    return (
        <Card as="section" aria-live="polite">
            <ProcessingStepper status={session.status} source={session.source} has_transcript={!!session.transcript} />
            {failed ? (
                <div className="mt-6">
                    <p className="font-semibold" style={{ color: 'var(--danger)' }}>
                        Something went wrong
                    </p>
                    <p className="mt-1 text-[15px]" style={{ color: 'var(--ink-2)' }}>
                        {session.error ?? 'The session could not be processed.'}
                    </p>
                    <Button className="mt-4" variant="primary" onClick={on_retry} disabled={busy}>
                        {busy ? 'Retrying…' : 'Retry'}
                    </Button>
                </div>
            ) : (
                <p className="ta-muted mt-6 text-[15px]">
                    {session.status === 'recording' ? 'This recording has not been finished yet.' : 'This usually takes a minute or two. You can leave this page — it keeps working, and the session will be ready when you come back.'}
                </p>
            )}
        </Card>
    );
};
