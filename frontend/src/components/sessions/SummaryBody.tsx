import type { ReactNode } from 'react';
import type { SessionSummary } from '@therapy-aid/shared';
import { Markdown } from '@/components/markdown/Markdown';
import './sessions.css';

/* The ready session's substance: overview (markdown), key points, and what David suggested — plain
   sections on the page under small uppercase labels, not nested cards. Sections with nothing in
   them are left out rather than shown empty. */

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
    <section aria-labelledby={id}>
        <h2 id={id} className="ta-label">
            {title}
        </h2>
        {children}
    </section>
);

const Bullets = ({ id, title, items }: { id: string; title: string; items: string[] }) =>
    items.length === 0 ? null : (
        <Section id={id} title={title}>
            <ul className="ta-bullets">
                {items.map((item, i) => (
                    <li key={i}>{item}</li>
                ))}
            </ul>
        </Section>
    );

export const SummaryBody = ({ summary }: { summary: SessionSummary }) => (
    <>
        <Section id="overview-title" title="Overview">
            <Markdown text={summary.overview} />
        </Section>
        <Bullets id="key-points-title" title="Key points" items={summary.key_points} />
        <Bullets id="advice-title" title="What David suggested" items={summary.therapist_advice} />
    </>
);
