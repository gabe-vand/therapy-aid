import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '@/components/shell/AppShell';
import Chat from '@/pages/Chat';
import Home from '@/pages/Home';
import Journal from '@/pages/Journal';
import ProblemDetail from '@/pages/ProblemDetail';
import Problems from '@/pages/Problems';
import Record from '@/pages/Record';
import SessionDetail from '@/pages/SessionDetail';
import Sessions from '@/pages/Sessions';
import Settings from '@/pages/Settings';
import UploadNotes from '@/pages/UploadNotes';
import { paths } from '@/services/paths';

/* Flat route table — one page component per screen, all inside the AppShell layout. Paths come
   from services/paths.ts (links use the same builders). The static /sessions/record and
   /sessions/notes outrank /sessions/:id. Unknown paths fall back to home. */
export default function App() {
    return (
        <Routes>
            <Route element={<AppShell />}>
                <Route index element={<Home />} />
                <Route path={paths.sessions} element={<Sessions />} />
                <Route path={paths.record} element={<Record />} />
                <Route path={paths.upload_notes} element={<UploadNotes />} />
                <Route path={paths.session(':id')} element={<SessionDetail />} />
                <Route path={paths.problems} element={<Problems />} />
                <Route path={paths.problem(':id')} element={<ProblemDetail />} />
                <Route path={paths.journal} element={<Journal />} />
                <Route path={paths.journal_entry(':id')} element={<Journal />} />
                <Route path={paths.chat} element={<Chat />} />
                <Route path={paths.chat_thread(':id')} element={<Chat />} />
                <Route path={paths.settings} element={<Settings />} />
                <Route path="*" element={<Navigate to={paths.home} replace />} />
            </Route>
        </Routes>
    );
}
