import { useEffect, useState, type MouseEvent } from 'react';
import './session-detail.css';

/* The desktop mini-navigation beside a session (≥1100px only; CSS hides it below): one anchor per
   section on the page. Clicking scrolls smoothly instead of changing the URL, and the section in
   view is marked aria-current — a light scroll-spy on IntersectionObserver, skipped where the
   browser (or the test DOM) has none. */

export type NavSection = { id: string; label: string };

export const SessionNav = ({ sections }: { sections: NavSection[] }) => {
    const [active, set_active] = useState(sections[0]?.id ?? '');
    const key = sections.map((s) => s.id).join(',');

    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) set_active(visible[0].target.id);
            },
            { rootMargin: '0px 0px -60% 0px' },
        );
        for (const id of key.split(',')) {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        }
        return () => observer.disconnect();
    }, [key]);

    const jump = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        set_active(id);
    };

    if (sections.length < 2) return null;
    return (
        <nav aria-label="On this page" className="ta-snav">
            <p className="ta-snav__title">On this page</p>
            {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="ta-snav__link" aria-current={active === s.id ? 'location' : undefined} onClick={(e) => jump(e, s.id)}>
                    {s.label}
                </a>
            ))}
        </nav>
    );
};
