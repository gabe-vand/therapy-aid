import type { ApiEnvelope } from '@therapy-aid/shared';
import { env } from '@/services/env';

/* Thin fetch layer — the only module that calls fetch. Components never import it; hooks in
   services/hooks/ do. Every call resolves to the { data, status_code, message } envelope and
   NEVER throws, so a hook's loading flag always comes back down. Success is
   `res.status_code === 200 && res.data !== null`; on failure `message` is safe to show. */

type Payload = Record<string, unknown>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export const UNREACHABLE = 'Cannot reach the server. Check your connection, or try again shortly.';

/* `sessions/4` and `/sessions/4` both become `${api_base_url}/sessions/4`. */
const url = (path: string): string => `${env.api_base_url}/${path.replace(/^\/+/, '')}`;

/* One request, normalised: a network failure or a non-JSON body (a proxy's 502 page) becomes an
   envelope with data null and a human message instead of an exception. */
const send = async <T>(method: Method, path: string, body?: BodyInit, content_type = 'application/json'): Promise<ApiEnvelope<T | null>> => {
    let response: Response;
    try {
        response = await fetch(url(path), { method, body, headers: { 'Content-Type': content_type } });
    } catch {
        return { data: null, status_code: 0, message: UNREACHABLE };
    }

    try {
        return (await response.json()) as ApiEnvelope<T>;
    } catch {
        return { data: null, status_code: response.status, message: `The server is unavailable (HTTP ${response.status}).` };
    }
};

const json = (payload: Payload | undefined): string | undefined => (payload === undefined ? undefined : JSON.stringify(payload));

export const getAPI = <T>(path: string) => send<T>('GET', path);

export const postAPI = <T>(path: string, payload: Payload = {}) => send<T>('POST', path, json(payload));

export const putAPI = <T>(path: string, payload: Payload = {}) => send<T>('PUT', path, json(payload));

export const patchAPI = <T>(path: string, payload: Payload = {}) => send<T>('PATCH', path, json(payload));

export const deleteAPI = <T>(path: string) => send<T>('DELETE', path);

/* Raw-body POST (audio chunks): the blob goes as-is with its own Content-Type, no JSON. */
export const uploadAPI = <T>(path: string, blob: Blob, mime: string) => send<T>('POST', path, blob, mime);

/* True when an envelope carries usable data — the check every hook makes. */
export const isOk = <T>(res: ApiEnvelope<T | null>): res is ApiEnvelope<T> => res.status_code === 200 && res.data !== null;
