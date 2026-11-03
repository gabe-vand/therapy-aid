import { FileText, Mic, NotebookPen } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { paths } from '@/services/paths';
import { greeting } from './week';
import './home.css';

/* Home's opening row: a greeting for the time of day as the title, today's full date under it,
   and the three ways to add something on the right — Record (the primary action), Add notes and
   Write. On a phone the actions drop under the title as a 3-up row of 40px buttons. */

const ACTIONS = [
    { to: paths.record, label: 'Record', Icon: Mic, variant: 'primary' },
    { to: paths.upload_notes, label: 'Add notes', Icon: FileText, variant: 'secondary' },
    { to: paths.journal_new, label: 'Write', Icon: NotebookPen, variant: 'secondary' },
] as const;

export const HomeHeader = ({ now = new Date() }: { now?: Date }) => (
    <header className="ta-home-head">
        <div className="min-w-0">
            <h1 className="ta-home-head__title">{greeting(now)}</h1>
            <p className="ta-home-head__date">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <nav aria-label="Quick actions" className="ta-home-head__actions">
            {ACTIONS.map(({ to, label, Icon, variant }) => (
                <ButtonLink key={to} to={to} variant={variant}>
                    <Icon aria-hidden />
                    {label}
                </ButtonLink>
            ))}
        </nav>
    </header>
);
