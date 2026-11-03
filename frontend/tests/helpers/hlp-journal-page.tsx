import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Journal from '@/pages/Journal';
import type { stub_api } from './hlp-fetch';

/* Shared setup for the Journal page tests: the page under the same two routes App.tsx declares,
   plus a location readout so navigation after an entry is created is observable; a manual clock
   step; the requests the page made; typing into the (stubbed) editor. Each test file also mocks
   RichEditor with hlp-rich-editor.tsx, because happy-dom cannot lay out ProseMirror. */

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

export const show = (path = '/journal') =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Where />
            <Routes>
                <Route path="/journal" element={<Journal />} />
                <Route path="/journal/:id" element={<Journal />} />
            </Routes>
        </MemoryRouter>,
    );

export const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
export const requests = (mock: ReturnType<typeof stub_api>) => mock.mock.calls.map((c) => `${(c[1] as RequestInit | undefined)?.method ?? 'GET'} ${c[0]}`);
export const type = (value: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Journal entry' }), { target: { value } });
