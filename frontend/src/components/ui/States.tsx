import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from './Button';
import './ui.css';

/* Page furniture: the title row every screen opens with (with an optional back link above the
   title), the empty state (what this is and the one action that fills it), and the error state
   (the envelope's message + Retry). Every async screen shows one of loading / empty / data /
   error — never a blank page. BackLink is exported on its own for screens without a PageHeader. */

export type BackTarget = { to: string; label: string };

export const BackLink = ({ to, label }: BackTarget) => (
    <Link to={to} className="ta-back">
        <ChevronLeft aria-hidden />
        {label}
    </Link>
);

type PageHeaderProps = { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: BackTarget };

export const PageHeader = ({ title, subtitle, actions, back }: PageHeaderProps) => (
    <header className="ta-page-header">
        <div className="min-w-0">
            {back && <BackLink {...back} />}
            <h1 className="ta-page-header__title">{title}</h1>
            {subtitle && <p className="ta-page-header__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="ta-page-header__actions">{actions}</div>}
    </header>
);

type EmptyProps = { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode };

export const EmptyState = ({ title, body, action, icon }: EmptyProps) => (
    <div className="ta-empty">
        {icon && (
            <span aria-hidden className="ta-empty__icon">
                {icon}
            </span>
        )}
        <p className="ta-empty__title">{title}</p>
        {body && <p className="ta-empty__body">{body}</p>}
        {action && <div className="ta-empty__action">{action}</div>}
    </div>
);

export const ErrorState = ({ message, on_retry, retrying = false }: { message: string; on_retry?: () => void; retrying?: boolean }) => (
    <div role="alert" className="ta-error">
        <span>{message}</span>
        {on_retry && (
            <Button size="sm" onClick={on_retry} disabled={retrying}>
                {retrying ? 'Retrying…' : 'Retry'}
            </Button>
        )}
    </div>
);
