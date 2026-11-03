import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/* Renders a page at `path` (matching `pattern`) alongside marker routes, so a test can assert that
   the page navigated: <Marker path="/sessions/7"> shows "at /sessions/7". */
export const render_with_targets = (ui: ReactElement, { path, pattern, targets = [] }: { path: string; pattern: string; targets?: string[] }) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path={pattern} element={ui} />
                {targets.map((t) => (
                    <Route key={t} path={t} element={<p>at {t}</p>} />
                ))}
            </Routes>
        </MemoryRouter>,
    );
