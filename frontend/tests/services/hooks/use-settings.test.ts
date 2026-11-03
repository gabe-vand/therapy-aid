import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UNREACHABLE } from '@/services/api';
import { useSettings } from '@/services/hooks/use-settings';
import { envelope, sent_body, stub_api, stub_unreachable } from '../../helpers/hlp-fetch';

const profile = { profile: 'I am Gabe.', updated_at: '2026-10-01T12:00:00.000Z' };

describe('useSettings', () => {
    it('loads GET /api/settings/profile on mount', async () => {
        stub_api({ 'GET /api/settings/profile': profile });
        const { result } = renderHook(() => useSettings());
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.profile).toEqual(profile);
        expect(result.current.error).toBeNull();
    });

    it('surfaces a load failure, and reload recovers', async () => {
        stub_unreachable();
        const { result } = renderHook(() => useSettings());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe(UNREACHABLE);

        stub_api({ 'GET /api/settings/profile': profile });
        await act(() => result.current.reload());
        expect(result.current.profile).toEqual(profile);
        expect(result.current.error).toBeNull();
    });

    it('saves with PUT and keeps the server copy', async () => {
        const saved = { profile: 'New text', updated_at: '2026-10-02T12:00:00.000Z' };
        const mock = stub_api({ 'GET /api/settings/profile': profile, 'PUT /api/settings/profile': saved });
        const { result } = renderHook(() => useSettings());
        await waitFor(() => expect(result.current.loading).toBe(false));

        let ok = false;
        await act(async () => {
            ok = await result.current.save('New text');
        });
        expect(ok).toBe(true);
        expect(result.current.profile).toEqual(saved);
        expect(result.current.save_error).toBeNull();
        expect(mock.mock.calls[1]![1]).toMatchObject({ method: 'PUT' });
        expect(sent_body(mock, 1)).toEqual({ profile: 'New text' });
    });

    it('reports a rejected save and keeps the last saved copy', async () => {
        stub_api({ 'GET /api/settings/profile': profile, 'PUT /api/settings/profile': envelope(null, 400, 'profile: Too long (50,000 characters max).') });
        const { result } = renderHook(() => useSettings());
        await waitFor(() => expect(result.current.loading).toBe(false));

        let ok = true;
        await act(async () => {
            ok = await result.current.save('x');
        });
        expect(ok).toBe(false);
        expect(result.current.save_error).toBe('profile: Too long (50,000 characters max).');
        expect(result.current.profile).toEqual(profile);
        expect(result.current.saving).toBe(false);
    });
});
