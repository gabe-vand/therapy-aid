import type { Session } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProcessingStepper } from './ProcessingStepper';
import './session-header.css';

/* Shown in place of (or, after a late failure, above) the summary while the pipeline runs (stepper +
   reassurance that leaving is fine) or after it failed (the server's reason in plain words + Retry,
   which resumes at the step that broke — a transcript or summary that already exists is not
   re-bought). A failure after the summary was saved says so: the summary renders below the card.
   A recording that was never finished (a closed tab, a dead phone) offers "Finish this recording"
   once it is a few minutes old: its uploaded audio is safe on the server and can be processed. */

export const FINISH_AFTER_MS = 2 * 60 * 1000;

type Props = { session: Session; busy: boolean; on_retry: () => void; on_finish: () => void; now?: number };

export const ProcessingCard = ({ session, busy, on_retry, on_finish, now = Date.now() }: Props) => {
    const failed = session.status === 'failed';
    const has_summary = !!session.summary?.overview;
    const can_finish = session.status === 'recording' && now - Date.parse(session.created_at) >= FINISH_AFTER_MS;
    return (
        <Card as="section" aria-live="polite">
            <ProcessingStepper status={session.status} source={session.source} has_transcript={!!session.transcript} has_summary={has_summary} />
            {failed && (
                <div className="ta-proc__fail">
                    <p className="ta-proc__fail-title">{has_summary ? 'Your summary is saved, but updating your problems failed' : 'Something went wrong'}</p>
                    <p className="ta-proc__fail-body">
                        {session.error ?? 'The session could not be processed.'}
                        {has_summary && ' Retry finishes that step without summarizing again.'}
                    </p>
                    <Button className="mt-4" variant="primary" onClick={on_retry} disabled={busy}>
                        {busy ? 'Retrying…' : 'Retry'}
                    </Button>
                </div>
            )}
            {!failed && session.status === 'recording' && (
                <div>
                    <p className="ta-proc__note">
                        This recording has not been finished yet.
                        {can_finish && ' If it was interrupted (a closed tab or a dead battery), the audio that reached the server is safe: finish it to transcribe what was saved. Don’t do this while it is still recording on another device.'}
                    </p>
                    {can_finish && (
                        <Button className="mt-4" variant="primary" onClick={on_finish} disabled={busy}>
                            {busy ? 'Finishing…' : 'Finish this recording'}
                        </Button>
                    )}
                </div>
            )}
            {!failed && session.status !== 'recording' && <p className="ta-proc__note">This usually takes a minute or two. You can leave this page — it keeps working, and the session will be ready when you come back.</p>}
        </Card>
    );
};
