import { StatusRow } from '@/components/status/StatusRow';
import { useHello } from '@/services/hooks/use-hello';

/* Formats an ISO timestamp for the visit line; '—' before the first visit. */
const when = (iso: string | null): string => (iso ? new Date(iso).toLocaleString() : '—');

/* The hello-world shell: one card proving each layer on the Pi answers — the SPA (it rendered),
   the API (GET /hello came back) and SQLite (the visit counter persists across redeploys). */
export default function Home() {
    const { status, loading, recording, error, record_visit } = useHello();
    const api_state = loading ? 'pending' : status && !error ? 'ok' : 'down';

    return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
            <p className="text-sm tracking-wide uppercase" style={{ color: 'var(--muted)' }}>
                hosting smoke test
            </p>
            <h1 className="mt-1 text-4xl font-semibold">{status?.message ?? 'therapy-aid'}</h1>

            <section className="mt-8 rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <ul>
                    <StatusRow label="Frontend" state="ok" detail="React SPA served by nginx" />
                    <StatusRow label="API" state={api_state} detail={status ? `Hono on Bun · revision ${status.revision}` : (error ?? 'Connecting…')} />
                    <StatusRow label="Database" state={api_state} detail={status ? `SQLite ${status.sqlite_version} · ${status.visit_count} visits recorded` : '—'} />
                </ul>

                <div className="mt-6 flex flex-wrap items-center gap-4">
                    <button
                        type="button"
                        onClick={() => void record_visit()}
                        disabled={loading || recording}
                        className="rounded-lg px-4 py-2 font-medium disabled:opacity-50"
                        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                        {recording ? 'Recording…' : 'Record a visit'}
                    </button>
                    {status && (
                        <span className="text-sm" style={{ color: 'var(--muted)' }}>
                            first {when(status.first_visit_at)} · last {when(status.last_visit_at)}
                        </span>
                    )}
                </div>
            </section>
        </main>
    );
}
