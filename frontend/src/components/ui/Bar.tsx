import './ui.css';

/* A thin horizontal bar, `value` out of `max` (the widest row of a list is `max`), in the accent on
   a recessed track. Decorative: the number beside it is the accessible content, so the bar itself
   is hidden from screen readers. */

export const Bar = ({ value, max, className }: { value: number; max: number; className?: string }) => {
    const pct = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;
    return (
        <span aria-hidden className={`ta-bar${className ? ` ${className}` : ''}`}>
            <span className="ta-bar__fill" style={{ width: `${pct}%` }} />
        </span>
    );
};
