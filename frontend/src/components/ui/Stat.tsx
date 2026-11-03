import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import './ui.css';

/* A stat tile: an eyebrow label, one big value (20px, tabular numbers) and a muted line of context
   under it. With `to` the whole tile is a link with a chevron. Tiles stack inside ONE card with
   hairline dividers (wrap them in .ta-stats) — never a card per tile. */

type Props = { label: string; value: ReactNode; sub?: ReactNode; to?: string; aside?: ReactNode };

export const Stat = ({ label, value, sub, to, aside }: Props) => {
    const body = (
        <>
            <span className="ta-stat__body">
                <span className="ta-eyebrow">{label}</span>
                <span className="ta-stat__value ta-num">
                    {value}
                    {aside}
                </span>
                {sub && <span className="ta-stat__sub">{sub}</span>}
            </span>
            {to && <ChevronRight aria-hidden className="ta-stat__chev" />}
        </>
    );
    if (to)
        return (
            <Link to={to} className="ta-stat ta-stat--link">
                {body}
            </Link>
        );
    return <div className="ta-stat">{body}</div>;
};
