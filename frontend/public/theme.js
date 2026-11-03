/* Sets <html data-theme> before first paint so the page never flashes the wrong theme. A classic
   file (not inline) because the Pi's CSP is script-src 'self'. Keep in sync with
   src/services/theme.ts: key 'ta-theme', values 'light' | 'dark' | 'system', default 'light'. */
(function () {
    var pref = 'light';
    try {
        var stored = window.localStorage.getItem('ta-theme');
        if (stored === 'light' || stored === 'dark' || stored === 'system') pref = stored;
    } catch (e) {
        /* storage blocked (private mode): fall back to the default */
    }
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
