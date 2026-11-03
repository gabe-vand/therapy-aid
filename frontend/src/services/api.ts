import type { ApiEnvelope } from '@therapy-aid/shared';
import { env } from '@/services/env';

/* Thin fetch layer — the only module that calls fetch. Components never import it; hooks in
   services/hooks/ do. Every call resolves to the { data, status_code, message } envelope and
   NEVER throws, so a hook's loading flag always comes back down. */

type Payload = Record<string, unknown>;

export const UNREACHABLE = 'Cannot reach the server. Check your connection, or try again shortly.';

/* One request, normalised: a network failure or a non-JSON body (a proxy's 502 page) becomes an
   envelope with data null and a human message instead of an exception. */
const request = async <T>(method: 'GET' | 'POST', path: string, payload?: Payload): Promise<ApiEnvelope<T | null>> => {
    let response: Response;
    try {
        const body = payload === undefined ? undefined : JSON.stringify(payload);
        response = await fetch(`${env.api_base_url}/${path}`, { method, body, headers: { 'Content-Type': 'application/json' } });
    } catch {
        return { data: null, status_code: 0, message: UNREACHABLE };
    }

    try {
        return (await response.json()) as ApiEnvelope<T>;
    } catch {
        return { data: null, status_code: response.status, message: `The server is unavailable (HTTP ${response.status}).` };
    }
};

export const getAPI = <T>(path: string) => request<T>('GET', path);

export const postAPI = <T>(path: string, payload: Payload = {}) => request<T>('POST', path, payload);
