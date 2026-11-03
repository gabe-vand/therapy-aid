import { FileText, Mic, NotebookPen } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { paths } from '@/services/paths';
import './home.css';

/* Home's three starting points as one row of compact secondary buttons (a single column of 40px
   buttons on a phone): record a session, add notes, write in the journal. */

const ACTIONS = [
    { to: paths.record, label: 'Record', Icon: Mic },
    { to: paths.upload_notes, label: 'Add notes', Icon: FileText },
    { to: paths.journal, label: 'Journal', Icon: NotebookPen },
] as const;

export const QuickActions = () => (
    <nav aria-label="Quick actions" className="ta-quick">
        {ACTIONS.map(({ to, label, Icon }) => (
            <ButtonLink key={to} to={to}>
                <Icon size={15} aria-hidden />
                {label}
            </ButtonLink>
        ))}
    </nav>
);
