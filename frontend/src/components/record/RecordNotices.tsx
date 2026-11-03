import type { ReactNode } from 'react';

/* Pre-flight warnings for the Record screen: an insecure origin (browsers hide the microphone
   without HTTPS — a warning, not a block, since localhost works) and a browser with no recorder. */

const Notice = ({ children }: { children: ReactNode }) => (
    <div role="note" className="mb-4 rounded-xl px-4 py-3 text-[15px]" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
        {children}
    </div>
);

export const RecordNotices = ({ secure, supported }: { secure: boolean; supported: boolean }) => (
    <>
        {!secure && <Notice>This page is not on a secure (HTTPS) connection, so your browser may refuse microphone access. Open the app through its tailnet https address.</Notice>}
        {!supported && <Notice>This browser cannot record audio. Try Safari or Chrome. You can still add notes by hand.</Notice>}
    </>
);
