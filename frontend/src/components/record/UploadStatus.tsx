import { Button } from '@/components/ui/Button';
import { format_elapsed, TIMESLICE_MS } from '@/services/recorder-media';
import './record.css';

/* Proof that the audio is leaving the phone, in minutes of audio rather than upload pieces
   ("Saved to the server: 07:30 of 08:00", each piece being one 30-second timeslice), plus an
   honest, fixed-wording warning when a piece could not be sent — the raw server message is not
   shown, it means nothing here. The audio is kept and retried; "Retry now" sends it at once,
   while recording as well as when finishing. Hidden until the first piece exists. */

type Props = { uploaded: number; total: number; stalled: string | null; on_retry: () => void };

const audio_clock = (pieces: number): string => format_elapsed((pieces * TIMESLICE_MS) / 1000);

export const UploadStatus = ({ uploaded, total, stalled, on_retry }: Props) => {
    if (total === 0 && !stalled) return null;
    const percent = total === 0 ? 0 : Math.round((uploaded / total) * 100);
    return (
        <div className="mt-2 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
            <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-medium">
                    Saved to the server: {audio_clock(uploaded)} of {audio_clock(total)}
                </span>
                <span className="ta-muted">{percent}%</span>
            </div>
            <div className="ta-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={uploaded} aria-label="Upload progress">
                <span style={{ width: `${percent}%` }} />
            </div>
            {stalled && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }} role="status">
                    <span>Upload paused. Your audio is safe on this device and will upload when the connection is back.</span>
                    <Button size="sm" onClick={on_retry}>
                        Retry now
                    </Button>
                </div>
            )}
        </div>
    );
};
