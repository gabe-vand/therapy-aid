import type { AiUsage, AiUsageRow } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Card, Chip, Loading, Skeleton } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/States';
import { relative_time } from '@/services/dates';
import './settings.css';

/* What the AI has cost since the server last started, one row per task with the model it is
   routed to. Input folds in tokens written to the prompt cache (they are sent fresh); Cached is
   the part read back at a fraction of the price. The numbers live in server memory, so they
   restart from zero on every deploy — the note says so rather than letting a zero look like a bug. */

const int = (n: number) => n.toLocaleString('en-US');

// Sub-cent totals matter here (a Haiku call is a fraction of a cent), so keep four places below $0.01.
export const format_usd = (n: number) => (n === 0 ? '$0.00' : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

const task_label = (task: string) => {
    const words = task.replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
};

const Row = ({ row }: { row: AiUsageRow }) => (
    <tr data-idle={row.calls === 0}>
        <td>
            <span className="font-medium">{task_label(row.task)}</span>
            {!row.is_configured && (
                <>
                    {' '}
                    <Chip>earlier override</Chip>
                </>
            )}
            <span className="ta-muted block text-[12px]">
                {row.model} · {row.effort}
            </span>
        </td>
        <td>{int(row.calls)}</td>
        <td>{int(row.input_tokens + row.cache_write_tokens)}</td>
        <td>{int(row.cache_read_tokens)}</td>
        <td>{int(row.output_tokens)}</td>
        <td>{format_usd(row.est_usd)}</td>
    </tr>
);

type Props = { usage: AiUsage | null; loading: boolean; error: string | null; on_reload: () => void };

export const AiUsageCard = ({ usage, loading, error, on_reload }: Props) => (
    <Card aria-labelledby="usage-title">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <h2 id="usage-title" className="text-lg font-semibold">
                    AI usage
                </h2>
                {usage && <p className="ta-muted mt-1 text-[14px]">Since {relative_time(usage.since)}</p>}
            </div>
            <Button size="sm" onClick={on_reload} disabled={loading}>
                Refresh
            </Button>
        </div>

        <div className="mt-4">
            {loading && usage === null ? (
                <Loading label="Loading usage…">
                    <Skeleton lines={4} height={20} />
                </Loading>
            ) : error !== null ? (
                <ErrorState message={error} on_retry={on_reload} />
            ) : usage ? (
                <>
                    {!usage.configured && (
                        <p className="mb-4 rounded-xl px-4 py-3 text-[14px] font-medium" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                            AI is not configured. Set ANTHROPIC_API_KEY on the server and every AI feature will start working.
                        </p>
                    )}
                    <div className="ta-usage-scroll">
                        <table className="ta-usage">
                            <thead>
                                <tr>
                                    <th scope="col">Task</th>
                                    <th scope="col">Calls</th>
                                    <th scope="col">Input</th>
                                    <th scope="col">Cached</th>
                                    <th scope="col">Output</th>
                                    <th scope="col">Est. cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usage.rows.map((row) => (
                                    <Row key={`${row.task}:${row.model}`} row={row} />
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={5}>Total</td>
                                    <td>{format_usd(usage.total_usd)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <p className="ta-muted mt-3 text-[13px]">Totals reset whenever the server restarts, including every deploy. Costs are estimates from list prices.</p>
                </>
            ) : null}
        </div>
    </Card>
);
