import { useEffect, useRef } from 'react';

/* For editors that autosave on a debounce: a phone that switches apps, locks, or a tab that is
   closed or refreshed never unmounts the React tree, so an effect cleanup never runs and the
   debounced text is lost. This runs `flush` the moment the page is hidden (visibilitychange →
   hidden, pagehide — the last events a mobile browser reliably delivers before freezing or
   discarding the page) and before unload, and asks the browser to confirm closing while
   `unsaved()` still reports text the server has not got. */
export const usePageExit = (flush: () => void, unsaved: () => boolean) => {
    const latest = useRef({ flush, unsaved });
    latest.current = { flush, unsaved };

    useEffect(() => {
        const on_hidden = () => {
            if (document.visibilityState === 'hidden') latest.current.flush();
        };
        const on_pagehide = () => latest.current.flush();
        const on_beforeunload = (e: BeforeUnloadEvent) => {
            latest.current.flush();
            if (!latest.current.unsaved()) return;
            e.preventDefault();
            e.returnValue = '';
        };
        document.addEventListener('visibilitychange', on_hidden);
        window.addEventListener('pagehide', on_pagehide);
        window.addEventListener('beforeunload', on_beforeunload);
        return () => {
            document.removeEventListener('visibilitychange', on_hidden);
            window.removeEventListener('pagehide', on_pagehide);
            window.removeEventListener('beforeunload', on_beforeunload);
        };
    }, []);
};
