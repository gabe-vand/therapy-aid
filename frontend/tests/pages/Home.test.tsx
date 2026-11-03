import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '@/pages/Home';
import { hello_status, stub_hello_api, stub_unreachable } from '../helpers/hlp-fetch';

describe('Home', () => {
    it('shows the greeting and every layer as up', async () => {
        stub_hello_api(hello_status());
        render(<Home />);

        expect(await screen.findByText('Hello from therapy-aid')).toBeInTheDocument();
        expect(screen.getByText(/revision abc1234/)).toBeInTheDocument();
        expect(screen.getByText(/3 visits recorded/)).toBeInTheDocument();
    });

    it('records a visit and shows the new count', async () => {
        stub_hello_api(hello_status(), hello_status({ visit_count: 4 }));
        render(<Home />);
        await screen.findByText(/3 visits recorded/);

        fireEvent.click(screen.getByRole('button', { name: 'Record a visit' }));

        expect(await screen.findByText(/4 visits recorded/)).toBeInTheDocument();
    });

    it('marks the API down when the server is unreachable', async () => {
        stub_unreachable();
        const { container } = render(<Home />);

        expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
        expect(container.querySelectorAll('[data-state="down"]')).toHaveLength(2);
    });
});
