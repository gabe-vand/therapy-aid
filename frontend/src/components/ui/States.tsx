import type { ReactNode } from 'react';
import { Button } from './Button';
import './ui.css';

/* Page furniture: the title row every screen opens with, the empty state (what this is and the
   one action that fills it), and the error state (the envelope's message + Retry). Every async
   screen shows one of loading / empty / data / error — never a blank page. */

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) => (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            {subtitle && <p className="ta-muted mt-1 text-[15px]">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
);

export const EmptyState = ({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) => (
    <div className="ta-card px-6 py-10 text-center" style={{ borderStyle: 'dashed', background: 'transparent' }}>
        <p className="text-lg font-semibold">{title}</p>
        {body && <p className="ta-muted mx-auto mt-2 max-w-md text-[15px]">{body}</p>}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
);

export const ErrorState = ({ message, on_retry, retrying = false }: { message: string; on_retry?: () => void; retrying?: boolean }) => (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
        <span className="text-[15px] font-medium">{message}</span>
        {on_retry && (
            <Button size="sm" onClick={on_retry} disabled={retrying}>
                {retrying ? 'Retrying…' : 'Retry'}
            </Button>
        )}
    </div>
);
