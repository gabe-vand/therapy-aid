import type { ReactNode } from 'react';
import type { SessionSummary } from '@therapy-aid/shared';
import { Markdown } from '@/components/markdown/Markdown';
import './session-detail.css';

/* The ready session's substance, as anchored sections the desktop mini-nav jumps between: the
   overview as prose, the key points as a numbered list (quiet tabular numbers), and what David
   suggested — the most valuable words on the page — as weighted items on an accent rule. Sections
   with nothing in them are left out rather than shown empty. */

export const DetailSection = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
    <section id={id} aria-labelledby={`${id}-title`} className="ta-ssec">
        <h2 id={`${id}-title`} className="ta-ssec__title">
            {title}
        </h2>
        {children}
    </section>
);

/* The sections a summary will render, in page order — the mini-nav is built from the same list. */
export const summary_sections = (summary: SessionSummary): { id: string; label: string }[] => [
    { id: 'overview', label: 'Overview' },
    ...(summary.key_points.length > 0 ? [{ id: 'key-points', label: 'Key points' }] : []),
    ...(summary.therapist_advice.length > 0 ? [{ id: 'advice', label: 'David suggested' }] : []),
];

export const SummaryBody = ({ summary }: { summary: SessionSummary }) => (
    <>
        <DetailSection id="overview" title="Overview">
            <Markdown text={summary.overview} />
        </DetailSection>
        {summary.key_points.length > 0 && (
            <DetailSection id="key-points" title="Key points">
                <ol className="ta-points">
                    {summary.key_points.map((point, i) => (
                        <li key={i}>{point}</li>
                    ))}
                </ol>
            </DetailSection>
        )}
        {summary.therapist_advice.length > 0 && (
            <DetailSection id="advice" title="What David suggested">
                <ul className="ta-advice">
                    {summary.therapist_advice.map((advice, i) => (
                        <li key={i}>{advice}</li>
                    ))}
                </ul>
            </DetailSection>
        )}
    </>
);
