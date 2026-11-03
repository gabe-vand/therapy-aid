import { Navigate, Route, Routes } from 'react-router-dom';
import Home from '@/pages/Home';

/* Flat route table — one page component per screen. Unknown paths fall back to home. */
export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
