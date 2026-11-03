// The importer's HTTP client: speaks the API's { data, status_code, message } envelope and turns
// every failure (network, non-200, non-JSON) into one readable ApiError, so the CLI can print the
// reason and stop instead of drowning in stack traces. fetch is injectable for tests.

export interface Api {
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    put<T>(path: string, body?: unknown): Promise<T>;
}

/** status 0 = the server could not be reached at all. */
export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

const REQUEST_TIMEOUT_MS = 60_000;

const UNAUTHORIZED_HINT = ' (not signed in to the tailnet as the allowed user, or ALLOWED_TAILSCALE_LOGIN is unset on a non-development server)';

/** Builds an Api rooted at `base` (see apiBase in seed-parse.ts). Returns `data` of a 200 envelope. */
export const createApi = (base: string, fetchImpl: typeof fetch = fetch): Api => {
    const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
        let res: Response;
        try {
            res = await fetchImpl(`${base}${path}`, {
                method,
                headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        } catch (e) {
            const why = e instanceof Error ? e.message : String(e);
            throw new ApiError(`Could not reach ${base} (${why}). Is the server up, and are you on the tailnet?`, 0);
        }
        const envelope = (await res.json().catch(() => null)) as { data?: T; message?: string } | null;
        if (!res.ok || !envelope) {
            const detail = envelope?.message ? ` - ${envelope.message}` : '';
            throw new ApiError(`${method} ${path} failed: HTTP ${res.status}${detail}${res.status === 401 ? UNAUTHORIZED_HINT : ''}`, res.status);
        }
        return envelope.data as T;
    };
    return {
        get: (path) => call('GET', path),
        post: (path, body = {}) => call('POST', path, body),
        put: (path, body = {}) => call('PUT', path, body),
    };
};
