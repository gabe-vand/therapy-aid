import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { paths } from '@/services/paths';
import { render_app } from './helpers/hlp-render';

// The route table: every path renders the right page inside the shell. Pages are replaced by
// markers (vitest isolates mocks per file), so this test is about App.tsx alone and stays
// valid as the real pages land.

const PAGES = ['Home', 'Sessions', 'SessionDetail', 'Record', 'UploadNotes', 'Problems', 'ProblemDetail', 'Journal', 'Chat', 'Settings'] as const;

vi.mock('@/pages/Home', () => ({ default: () => <p>page:Home</p> }));
vi.mock('@/pages/Sessions', () => ({ default: () => <p>page:Sessions</p> }));
vi.mock('@/pages/SessionDetail', () => ({ default: () => <p>page:SessionDetail</p> }));
vi.mock('@/pages/Record', () => ({ default: () => <p>page:Record</p> }));
vi.mock('@/pages/UploadNotes', () => ({ default: () => <p>page:UploadNotes</p> }));
vi.mock('@/pages/Problems', () => ({ default: () => <p>page:Problems</p> }));
vi.mock('@/pages/ProblemDetail', () => ({ default: () => <p>page:ProblemDetail</p> }));
vi.mock('@/pages/Journal', () => ({ default: () => <p>page:Journal</p> }));
vi.mock('@/pages/Chat', () => ({ default: () => <p>page:Chat</p> }));
vi.mock('@/pages/Settings', () => ({ default: () => <p>page:Settings</p> }));

const ROUTES: [string, (typeof PAGES)[number]][] = [
    [paths.home, 'Home'],
    [paths.sessions, 'Sessions'],
    [paths.record, 'Record'],
    [paths.upload_notes, 'UploadNotes'],
    [paths.session(7), 'SessionDetail'],
    [paths.problems, 'Problems'],
    [paths.problem(3), 'ProblemDetail'],
    [paths.journal, 'Journal'],
    [paths.journal_entry(2), 'Journal'],
    [paths.chat, 'Chat'],
    [paths.chat_thread(5), 'Chat'],
    [paths.settings, 'Settings'],
];

describe('App routes', () => {
    it.each(ROUTES)('%s renders %s inside the shell', async (path, page) => {
        render_app(path);
        expect(await screen.findByText(`page:${page}`)).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    });

    it('sends unknown paths home', async () => {
        render_app('/nowhere');
        expect(await screen.findByText('page:Home')).toBeInTheDocument();
    });
});
