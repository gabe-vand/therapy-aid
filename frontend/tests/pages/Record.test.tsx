import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Record from '@/pages/Record';
import { stub_api } from '../helpers/hlp-fetch';
import { flush, install_fake_media, server, use_fake_clock } from '../helpers/hlp-recorder';
import { render_with_targets } from '../helpers/hlp-routes';

use_fake_clock();

const mount = () => render_with_targets(<Record />, { path: '/sessions/record', pattern: '/sessions/record', targets: ['/sessions/7'] });
const tap = async (name: string) => {
    await act(async () => void fireEvent.click(screen.getByRole('button', { name })));
};

describe('Record page', () => {
    it('starts idle with a big Start button', () => {
        install_fake_media();
        mount();
        expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled();
        expect(screen.getByRole('timer')).toHaveTextContent('00:00');
        expect(screen.queryByText(/saved to the server/i)).not.toBeInTheDocument();
    });

    it('records, shows the timer and upload progress, and Stop opens the session', async () => {
        const media = install_fake_media();
        server();
        mount();
        await tap('Start recording');
        expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
        expect(screen.getByText(/keep this screen open/i)).toBeInTheDocument();

        await flush(65_000);
        expect(screen.getByRole('timer')).toHaveTextContent('01:05');

        act(() => media.recorder().emit('a'));
        await flush();
        expect(screen.getByText('Saved to the server: 00:30 of 00:30')).toBeInTheDocument();

        await tap('Stop recording');
        await flush();
        expect(screen.getByText('at /sessions/7')).toBeInTheDocument();
    });

    it('explains a blocked microphone and lets the user try again', async () => {
        install_fake_media({ deny: 'NotAllowedError' });
        server();
        mount();
        await tap('Start recording');
        expect(screen.getByRole('alert')).toHaveTextContent(/blocked/i);
        expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled();
    });

    it('warns (without blocking) on an insecure origin', () => {
        install_fake_media();
        vi.stubGlobal('isSecureContext', false);
        mount();
        expect(screen.getByRole('note')).toHaveTextContent(/secure \(HTTPS\)/);
        expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled();
    });

    it('says so when the browser cannot record', () => {
        vi.stubGlobal('navigator', { userAgent: 'test' });
        mount();
        expect(screen.getByRole('note')).toHaveTextContent(/cannot record audio/i);
    });

    it('shows a paused-upload warning and keeps recording', async () => {
        const media = install_fake_media();
        stub_api({ 'POST /api/sessions/recordings': { id: 7 }, 'POST /api/sessions/7/chunks': () => new Response(JSON.stringify({ data: null, status_code: 503, message: 'Offline.' }), { status: 503 }) });
        mount();
        await tap('Start recording');
        act(() => media.recorder().emit('a'));
        await flush(10_000);
        expect(screen.getByText(/Upload paused\. Your audio is safe on this device/)).toBeInTheDocument();
        expect(screen.queryByText(/Offline/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry now' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    });

    it('when the mic dies, stays on the page to say when it stopped and links to the session', async () => {
        const media = install_fake_media();
        server();
        mount();
        await tap('Start recording');
        await flush(5_000);
        act(() => media.recorder().emit('a'));
        act(() => media.recorder().fail());
        await flush(1000);
        expect(screen.getByRole('alert')).toHaveTextContent(/stopped unexpectedly at 00:05/);
        expect(screen.queryByText('at /sessions/7')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open the session' })).toHaveAttribute('href', '/sessions/7');
    });
});
