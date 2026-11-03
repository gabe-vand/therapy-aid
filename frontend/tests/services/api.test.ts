import { describe, expect, it, vi } from 'vitest';
import { UNREACHABLE, deleteAPI, getAPI, isOk, patchAPI, postAPI, putAPI, uploadAPI } from '@/services/api';
import { envelope, sent_body, stub_api, stub_unreachable } from '../helpers/hlp-fetch';

describe('api', () => {
    it('sends each verb to /api/<path> with a JSON body, leading slash or not', async () => {
        const mock = stub_api({ '/api/x': (init: RequestInit | undefined) => ({ method: init?.method }) });
        expect((await getAPI('x')).data).toEqual({ method: 'GET' });
        expect((await postAPI('/x', { a: 1 })).data).toEqual({ method: 'POST' });
        expect((await putAPI('x', { b: 2 })).data).toEqual({ method: 'PUT' });
        expect((await patchAPI('x', { c: 3 })).data).toEqual({ method: 'PATCH' });
        expect((await deleteAPI('x')).data).toEqual({ method: 'DELETE' });
        expect(mock.mock.calls.every((c) => c[0] === '/api/x')).toBe(true);
        expect(sent_body(mock, 1)).toEqual({ a: 1 });
        expect(sent_body(mock, 3)).toEqual({ c: 3 });
        expect((mock.mock.calls[0]![1] as RequestInit).body).toBeUndefined();
    });

    it('sets keepalive only when asked (a save that must outlive the page)', async () => {
        const mock = stub_api({ '/api/x': {} });
        await patchAPI('x', { a: 1 }, { keepalive: true });
        await postAPI('x', { a: 1 });
        expect((mock.mock.calls[0]![1] as RequestInit).keepalive).toBe(true);
        expect((mock.mock.calls[1]![1] as RequestInit).keepalive).toBeUndefined();
    });

    it('uploads a blob as the raw body with its own content type', async () => {
        const mock = stub_api({ 'POST /api/sessions/4/chunks': { ok: true } });
        const blob = new Blob(['audio-bytes'], { type: 'audio/webm' });
        await uploadAPI('sessions/4/chunks?seq=0', blob, 'audio/webm');
        const [url, init] = mock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/api/sessions/4/chunks?seq=0');
        expect(init.body).toBe(blob);
        expect(init.headers).toEqual({ 'Content-Type': 'audio/webm' });
    });

    it('passes error envelopes through untouched', async () => {
        stub_api({ '/api/x': envelope({ expected: 3 }, 409, 'CONFLICT') });
        const res = await getAPI('x');
        expect(res).toEqual({ data: { expected: 3 }, status_code: 409, message: 'CONFLICT' });
        expect(isOk(res)).toBe(false);
    });

    it('never throws: network failure and non-JSON bodies become envelopes', async () => {
        stub_unreachable();
        expect(await getAPI('x')).toEqual({ data: null, status_code: 0, message: UNREACHABLE });
        vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })));
        expect(await postAPI('x')).toEqual({ data: null, status_code: 502, message: 'The server is unavailable (HTTP 502).' });
    });

    it('isOk needs status 200 and non-null data', () => {
        expect(isOk({ data: {}, status_code: 200, message: 'OKAY' })).toBe(true);
        expect(isOk({ data: null, status_code: 200, message: 'OKAY' })).toBe(false);
    });
});
