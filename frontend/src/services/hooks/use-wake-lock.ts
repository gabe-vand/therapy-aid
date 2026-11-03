import { useEffect } from 'react';

/* Keeps the phone screen awake while `active` (a locked screen suspends the page and the recorder
   with it). The Screen Wake Lock API is optional — absent on older browsers and insecure origins —
   so everything is guarded and a refusal is silently fine: recording works without it. The browser
   drops the lock whenever the tab is hidden, so it is re-requested when the tab comes back. */
export const useWakeLock = (active: boolean) => {
    useEffect(() => {
        if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return;
        let lock: WakeLockSentinel | null = null;
        let released = false;

        const acquire = async () => {
            try {
                const next = await navigator.wakeLock.request('screen');
                if (released) void next.release().catch(() => undefined);
                else lock = next;
            } catch {
                // Denied (battery saver, hidden tab): not worth interrupting a recording over.
            }
        };
        const on_visible = () => {
            if (document.visibilityState === 'visible') void acquire();
        };

        void acquire();
        document.addEventListener('visibilitychange', on_visible);
        return () => {
            released = true;
            document.removeEventListener('visibilitychange', on_visible);
            void lock?.release().catch(() => undefined);
        };
    }, [active]);
};
