import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import './record.css';

/* Warning blocks for the Record screen: a --warn-soft panel with an alert icon. Notice is also the
   block for the live capture warning and the "stopped unexpectedly" notice. RecordNotices holds the
   pre-flight ones: an insecure origin (browsers hide the microphone without HTTPS — a warning, not
   a block, since localhost works) and a browser with no recorder. */

export const Notice = ({ children, role = 'note' }: { children: ReactNode; role?: 'note' | 'alert' | 'status' }) => (
    <div role={role} className="ta-notice">
        <AlertTriangle size={16} aria-hidden />
        <div>{children}</div>
    </div>
);

export const RecordNotices = ({ secure, supported }: { secure: boolean; supported: boolean }) => (
    <>
        {!secure && <Notice>This page is not on a secure (HTTPS) connection, so your browser may refuse microphone access. Open the app through its tailnet https address.</Notice>}
        {!supported && <Notice>This browser cannot record audio. Try Safari or Chrome. You can still add notes by hand.</Notice>}
    </>
);
