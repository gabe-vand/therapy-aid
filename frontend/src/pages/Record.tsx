import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RecordControl } from '@/components/record/RecordControl';
import { RecordNotices } from '@/components/record/RecordNotices';
import { UploadStatus } from '@/components/record/UploadStatus';
import { Card } from '@/components/ui/Card';
import { ErrorState, PageHeader } from '@/components/ui/States';
import { useRecorder } from '@/services/hooks/use-recorder';
import { paths } from '@/services/paths';

/* Record a live session. Audio uploads in 30-second pieces while you talk, so a dead battery costs
   at most the last half minute. Stop sends the last piece, tells the server it is complete, and
   opens the session to watch it get transcribed and summarized — unless the microphone died under
   the recording, in which case the page stays put to say when it stopped (the audio up to then is
   saved) and links to the session. A live capture warning (mic muted, no audio arriving) shows
   above the controls while recording. */
export default function Record() {
    const navigate = useNavigate();
    const { phase, elapsed_sec, uploaded, total, stalled, error, notice, capture_warning, session_id, supported, secure, start, stop, retry } = useRecorder();

    useEffect(() => {
        if (session_id !== null && !notice) navigate(paths.session(session_id), { replace: true });
    }, [session_id, notice, navigate]);

    return (
        <>
            <Link to={paths.sessions} className="ta-muted mb-4 inline-block text-sm font-medium hover:underline">
                ← Sessions
            </Link>
            <PageHeader title="Record a session" subtitle="Put your phone down near you, keep the screen on, and tap the button." />
            <RecordNotices secure={secure} supported={supported} />
            <Card>
                {capture_warning && (
                    <div role="alert" className="mb-4 rounded-xl px-4 py-3 text-[15px]" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                        {capture_warning}
                    </div>
                )}
                {notice && (
                    <div role="alert" className="mb-4 rounded-xl px-4 py-3 text-[15px]" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                        {notice}
                        {session_id !== null && (
                            <Link to={paths.session(session_id)} className="mt-2 block font-semibold underline">
                                Open the session
                            </Link>
                        )}
                    </div>
                )}
                <RecordControl phase={phase} elapsed_sec={elapsed_sec} on_start={() => void start()} on_stop={() => void stop()} />
                <UploadStatus uploaded={uploaded} total={total} stalled={stalled} on_retry={() => void retry()} />
                {error && (
                    <div className="mt-4">
                        <ErrorState message={error} on_retry={phase === 'finishing' && !stalled ? () => void retry() : undefined} />
                    </div>
                )}
            </Card>
            <p className="ta-muted mt-4 text-sm">Closing this tab while recording will ask you to confirm. Leaving the page stops the recording and saves what was captured.</p>
        </>
    );
}
