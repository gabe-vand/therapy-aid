/* Typed access to Vite environment variables. Every import.meta.env read in
   the app goes through this module so defaults live in exactly one place. */

type AppEnv = 'development' | 'production';

const read = (key: string, fallback: string): string => {
    const raw = (import.meta.env as Record<string, unknown>)[key];
    return typeof raw === 'string' && raw.length > 0 ? raw : fallback;
};

export const env = {
    /** Backend base URL — no trailing slash. Relative by default: the app is served from ONE
        origin, where nginx (Pi) and the Vite dev proxy both forward /api/* to the backend and
        strip the prefix. */
    api_base_url: read('VITE_API_BASE_URL', '/api').replace(/\/+$/, ''),
    /** Deployment environment label. */
    app_env: read('VITE_APP_ENV', 'development') as AppEnv,
};
