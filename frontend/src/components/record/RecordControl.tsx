import type { RecorderPhase } from '@/services/hooks/use-recorder';
import './record.css';

/* The big round button and the clock. One control, three meanings: start (idle), stop (recording),
   and a disabled "working" state while the mic is opening or the last audio is being sent. */

export const format_elapsed = (total_sec: number): string => {
    const h = Math.floor(total_sec / 3600);
    const m = Math.floor((total_sec % 3600) / 60);
    const s = total_sec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const MicIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
);

const StopIcon = () => (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <rect x="5" y="5" width="14" height="14" rx="3" />
    </svg>
);

const CAPTION: Record<RecorderPhase, string> = { idle: 'Tap to start recording', starting: 'Opening the microphone…', recording: 'Recording — keep this screen open', finishing: 'Finishing up…', done: 'Saved' };

type Props = { phase: RecorderPhase; elapsed_sec: number; on_start: () => void; on_stop: () => void };

export const RecordControl = ({ phase, elapsed_sec, on_start, on_stop }: Props) => {
    const live = phase === 'recording';
    const disabled = phase === 'starting' || phase === 'finishing' || phase === 'done';
    return (
        <div className="flex flex-col items-center gap-6 py-4">
            <div className="ta-rec-time" role="timer" aria-label="Elapsed recording time">
                {format_elapsed(elapsed_sec)}
            </div>
            <button type="button" className="ta-rec-btn" data-live={live} disabled={disabled} onClick={live ? on_stop : on_start} aria-label={live ? 'Stop recording' : 'Start recording'}>
                {live ? <StopIcon /> : <MicIcon />}
            </button>
            <p className="ta-muted text-[15px]" aria-live="polite">
                {CAPTION[phase]}
            </p>
        </div>
    );
};
