import { forwardRef, useState } from 'react';
import type { JournalInsight } from '@therapy-aid/shared';
import { Markdown } from '@/components/markdown/Markdown';
import { Button } from '@/components/ui/Button';
import { Loading, Skeleton } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/States';
import { format_date, format_time } from '@/services/dates';

/* Where "I have an idea…" answers land. The newest insight is the hero (markdown); older ones for
   this entry sit below in a collapsible history. While one is being written it shows a calm
   waiting state (it can take up to a minute); a failure shows the message with Try again. */

type Props = { insights: JournalInsight[]; generating: boolean; generate_error: string | null; history_error: string | null; on_retry: () => void; on_reload_history: () => void };

const stamp = (i: JournalInsight) => `${format_date(i.created_at, { year: false })}, ${format_time(i.created_at)}`;

export const InsightPanel = forwardRef<HTMLElement, Props>(function InsightPanel({ insights, generating, generate_error, history_error, on_retry, on_reload_history }, ref) {
    const [show_history, set_show_history] = useState(false);
    const [latest, ...earlier] = insights;

    if (!generating && !generate_error && !history_error && !latest) return null;
    return (
        <section ref={ref} className="ta-card mt-4 p-5 md:p-6" aria-label="Insights" style={{ background: 'var(--accent-soft)', borderColor: 'transparent' }}>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
                💡 An idea for you
            </h2>

            {generating && (
                <Loading label="Writing an insight">
                    <Skeleton lines={4} />
                    <p className="ta-muted mt-3 text-[14px]">Reading this entry alongside your recent sessions. This can take up to a minute.</p>
                </Loading>
            )}
            {generate_error && !generating && <ErrorState message={generate_error} on_retry={on_retry} />}
            {history_error && <ErrorState message={history_error} on_retry={on_reload_history} />}

            {!generating && latest && (
                <article>
                    <Markdown text={latest.body} />
                    <p className="ta-muted mt-3 text-[12px]">{stamp(latest)}</p>
                </article>
            )}

            {earlier.length > 0 && (
                <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--line-2)' }}>
                    <Button size="sm" variant="ghost" aria-expanded={show_history} onClick={() => set_show_history((v) => !v)}>
                        {show_history ? 'Hide earlier ideas' : `Earlier ideas (${earlier.length})`}
                    </Button>
                    {show_history && (
                        <ul className="mt-3 flex list-none flex-col gap-4 p-0">
                            {earlier.map((i) => (
                                <li key={i.id} className="ta-card p-4">
                                    <Markdown text={i.body} />
                                    <p className="ta-muted mt-2 text-[12px]">{stamp(i)}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
});
