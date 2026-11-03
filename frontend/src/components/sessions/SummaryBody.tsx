import type { SessionSummary } from '@therapy-aid/shared';
import { Markdown } from '@/components/markdown/Markdown';
import { Card } from '@/components/ui/Card';
import './sessions.css';

/* The ready session's substance: overview (markdown), key points, and what David suggested.
   Sections with nothing in them are left out rather than shown empty. */

const BulletCard = ({ id, title, items }: { id: string; title: string; items: string[] }) =>
    items.length === 0 ? null : (
        <Card as="section" aria-labelledby={id}>
            <h2 id={id} className="mb-3 text-lg font-semibold">
                {title}
            </h2>
            <ul className="ta-bullets">
                {items.map((item, i) => (
                    <li key={i}>{item}</li>
                ))}
            </ul>
        </Card>
    );

export const SummaryBody = ({ summary }: { summary: SessionSummary }) => (
    <>
        <Card as="section" aria-labelledby="overview-title">
            <h2 id="overview-title" className="mb-3 text-lg font-semibold">
                Overview
            </h2>
            <Markdown text={summary.overview} />
        </Card>
        <BulletCard id="key-points-title" title="Key points" items={summary.key_points} />
        <BulletCard id="advice-title" title="What David suggested" items={summary.therapist_advice} />
    </>
);
