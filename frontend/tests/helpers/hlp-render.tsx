import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '@/App';

/* Router-aware render helpers. render_at mounts one element at a URL (with a matching route
   pattern so useParams works); render_app mounts the whole App — shell and route table — at a URL. */

export const render_at = (ui: ReactElement, { path = '/', pattern = '*' }: { path?: string; pattern?: string } = {}) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path={pattern} element={ui} />
            </Routes>
        </MemoryRouter>,
    );

export const render_app = (path = '/') =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <App />
        </MemoryRouter>,
    );
