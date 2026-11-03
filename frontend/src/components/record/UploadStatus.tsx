import { Button } from '@/components/ui/Button';
import './record.css';

/* Proof that the audio is leaving the phone: "Uploaded N of M" with a bar, plus an honest warning
   when a chunk could not be sent (it is kept and retried — nothing is lost while the page stays
   open). Hidden until the first 30-second chunk exists. */

type Props = { uploaded: number; total: number; stalled: string | null; finishing: boolean; on_retry: () => void };

export const UploadStatus = ({ uploaded, total, stalled, finishing, on_retry }: Props) => {
    if (total === 0 && !stalled) return null;
    const percent = total === 0 ? 0 : Math.round((uploaded / total) * 100);
    return (
        <div className="mt-2 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
            <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-medium">
                    Uploaded {uploaded} of {total} {total === 1 ? 'chunk' : 'chunks'}
                </span>
                <span className="ta-muted">{percent}%</span>
            </div>
            <div className="ta-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={uploaded} aria-label="Upload progress">
                <span style={{ width: `${percent}%` }} />
            </div>
            {stalled && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }} role="status">
                    <span>Upload paused: {stalled} It is kept on this device and will retry.</span>
                    {finishing && (
                        <Button size="sm" onClick={on_retry}>
                            Try again
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};
