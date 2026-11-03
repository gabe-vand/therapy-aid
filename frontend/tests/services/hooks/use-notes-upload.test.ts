import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNotesUpload } from '@/services/hooks/use-notes-upload';
import { envelope, sent_body, stub_api } from '../../helpers/hlp-fetch';
import { session } from '../../helpers/hlp-sessions';

const input = { date: '2026-09-11', title: '  ', notes: '  We talked about sleep.  ' };

describe('useNotesUpload', () => {
    it('posts trimmed notes at noon local and resolves with the new session id', async () => {
        const mock = stub_api({ 'POST /api/sessions/notes': session({ id: 12, status: 'uploaded' }) });
        const { result } = renderHook(() => useNotesUpload());
        let id: number | null = null;
        await act(async () => void (id = await result.current.submit(input)));
        expect(id).toBe(12);
        const body = sent_body(mock) as { occurred_at: string; notes: string; title?: string };
        expect(body.notes).toBe('We talked about sleep.');
        expect(new Date(body.occurred_at).getHours()).toBe(12);
        expect(body).not.toHaveProperty('title');
        expect(result.current.error).toBeNull();
    });

    it('sends a title when given one', async () => {
        const mock = stub_api({ 'POST /api/sessions/notes': session({ id: 3 }) });
        const { result } = renderHook(() => useNotesUpload());
        await act(async () => void (await result.current.submit({ ...input, title: ' Sleep ' })));
        expect((sent_body(mock) as { title: string }).title).toBe('Sleep');
    });

    it('surfaces a validation message and resolves null', async () => {
        stub_api({ 'POST /api/sessions/notes': envelope(null, 400, 'notes: Write something first.') });
        const { result } = renderHook(() => useNotesUpload());
        let id: number | null = 1;
        await act(async () => void (id = await result.current.submit(input)));
        expect(id).toBeNull();
        expect(result.current.error).toBe('notes: Write something first.');
        expect(result.current.submitting).toBe(false);
    });

    it('rejects a missing date without calling the server', async () => {
        const mock = stub_api({});
        const { result } = renderHook(() => useNotesUpload());
        await act(async () => void (await result.current.submit({ ...input, date: '' })));
        expect(mock).not.toHaveBeenCalled();
        expect(result.current.error).toMatch(/date/i);
    });
});
