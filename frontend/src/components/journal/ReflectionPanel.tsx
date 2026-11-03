import { forwardRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { JournalInsight } from '@therapy-aid/shared';
import { Markdown } from '@/components/markdown/Markdown';
import { Button } from '@/components/ui/Button';
import { Loading, Skeleton } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/States';
import { format_date, format_time } from '@/services/dates';
import './journal-insights.css';

/* Where "Reflect on this entry" answers land, below the document at the same width. The newest
   reflection is the hero (markdown, on a soft accent wash); older ones for this entry sit below
   in a collapsible history, separated by hairlines rather than nested cards. While one is being
   written it shows a calm waiting state (it can take up to a minute); a failure shows the
   message with Retry. Margin notes are a different thing (MarginNotes.tsx). */

type Props = { reflections: JournalInsight[]; generating: boolean; generate_error: string | null; history_error: string | null; on_retry: () => void; on_reload_history: () => void };

const stamp = (i: JournalInsight) => `${format_date(i.created_at, { year: false })}, ${format_time(i.created_at)}`;

export const ReflectionPanel = forwardRef<HTMLElement, Props>(function ReflectionPanel({ reflections, generating, generate_error, history_error, on_retry, on_reload_history }, ref) {
    const [show_history, set_show_history] = useState(false);
    const [latest, ...earlier] = reflections;

    if (!generating && !generate_error && !history_error && !latest) return null;
    return (
        <section ref={ref} className="ta-insights" aria-label="Reflection">
            <h2 className="ta-insights__eyebrow">
                <Sparkles aria-hidden />
                Reflection
            </h2>

            {generating && (
                <Loading label="Writing a reflection">
                    <Skeleton lines={4} />
                    <p className="ta-insights__wait">Reading this entry alongside your recent sessions. This can take up to a minute.</p>
                </Loading>
            )}
            {generate_error && !generating && <ErrorState message={generate_error} on_retry={on_retry} />}
            {history_error && <ErrorState message={history_error} on_retry={on_reload_history} />}

            {!generating && latest && (
                <article>
                    <Markdown text={latest.body} />
                    <p className="ta-insights__stamp">{stamp(latest)}</p>
                </article>
            )}

            {earlier.length > 0 && (
                <div className="ta-insights__history">
                    <Button size="sm" variant="ghost" aria-expanded={show_history} onClick={() => set_show_history((v) => !v)}>
                        {show_history ? 'Hide earlier reflections' : `Earlier reflections (${earlier.length})`}
                    </Button>
                    {show_history && (
                        <ul className="ta-insights__list">
                            {earlier.map((i) => (
                                <li key={i.id}>
                                    <Markdown text={i.body} />
                                    <p className="ta-insights__stamp">{stamp(i)}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
});
