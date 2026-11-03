import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RecordControl } from '@/components/record/RecordControl';
import { Notice, RecordNotices } from '@/components/record/RecordNotices';
import { UploadStatus } from '@/components/record/UploadStatus';
import { Card } from '@/components/ui/Card';
import { ErrorState, PageHeader } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
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
        <Page width="reading">
            <PageHeader back={{ to: paths.sessions, label: 'Sessions' }} title="Record a session" subtitle="Put your phone down near you, keep the screen on, and tap the button." />
            <RecordNotices secure={secure} supported={supported} />
            <Card>
                {capture_warning && <Notice role="alert">{capture_warning}</Notice>}
                {notice && (
                    <Notice role="alert">
                        {notice}
                        {session_id !== null && (
                            <Link to={paths.session(session_id)} className="mt-2 block font-medium underline">
                                Open the session
                            </Link>
                        )}
                    </Notice>
                )}
                <RecordControl phase={phase} elapsed_sec={elapsed_sec} on_start={() => void start()} on_stop={() => void stop()} />
                <UploadStatus uploaded={uploaded} total={total} stalled={stalled} on_retry={() => void retry()} />
                {error && (
                    <div className="mt-4">
                        <ErrorState message={error} on_retry={phase === 'finishing' && !stalled ? () => void retry() : undefined} />
                    </div>
                )}
            </Card>
            <p className="ta-muted mt-4 text-[13px]">Closing this tab while recording will ask you to confirm. Leaving the page stops the recording and saves what was captured.</p>
        </Page>
    );
}
