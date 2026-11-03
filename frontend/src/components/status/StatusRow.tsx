type Props = {
    label: string;
    state: 'ok' | 'pending' | 'down';
    detail: string;
};

const DOT: Record<Props['state'], string> = {
    ok: 'var(--ok)',
    pending: 'var(--muted)',
    down: 'var(--danger)',
};

/* One layer of the stack (frontend / API / database) with a coloured status dot. */
export const StatusRow = ({ label, state, detail }: Props) => (
    <li className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid var(--line)' }} data-state={state}>
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DOT[state] }} />
        <span className="w-24 shrink-0 font-medium">{label}</span>
        <span className="min-w-0 truncate text-sm" style={{ color: 'var(--muted)' }}>
            {detail}
        </span>
    </li>
);
