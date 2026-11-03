import { Link } from 'react-router-dom';
import { paths } from '@/services/paths';

/* Home's three starting points, as large tap targets: record a session (the primary one, accent
   filled), add notes, write in the journal. */

const ACTIONS = [
    { to: paths.record, label: 'Record a session', hint: 'Capture it live', primary: true },
    { to: paths.upload_notes, label: 'Add notes', hint: 'Paste what you wrote', primary: false },
    { to: paths.journal, label: 'Write in journal', hint: 'Get it out of your head', primary: false },
] as const;

export const QuickActions = () => (
    <nav aria-label="Quick actions" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ACTIONS.map((a) => (
            <Link
                key={a.to}
                to={a.to}
                className="ta-card flex min-h-[72px] flex-col justify-center px-5 py-4 no-underline transition-colors"
                style={a.primary ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' } : { color: 'var(--ink)' }}>
                <span className="font-semibold">{a.label}</span>
                <span className="text-sm" style={{ opacity: 0.8 }}>
                    {a.hint}
                </span>
            </Link>
        ))}
    </nav>
);
