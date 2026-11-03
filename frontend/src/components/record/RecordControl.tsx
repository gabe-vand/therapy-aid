import { Mic, Square } from 'lucide-react';
import type { RecorderPhase } from '@/services/hooks/use-recorder';
import { format_elapsed } from '@/services/recorder-media';
import './record.css';

/* The round button and the clock. One control, three meanings: start (idle), stop (recording), and
   a disabled "working" state while the mic is opening or the last audio is being sent. The button
   is the hero; the elapsed time sits under it. */

const CAPTION: Record<RecorderPhase, string> = { idle: 'Tap to start recording', starting: 'Opening the microphone…', recording: 'Recording — keep this screen open', finishing: 'Finishing up…', done: 'Saved' };

type Props = { phase: RecorderPhase; elapsed_sec: number; on_start: () => void; on_stop: () => void };

export const RecordControl = ({ phase, elapsed_sec, on_start, on_stop }: Props) => {
    const live = phase === 'recording';
    const disabled = phase === 'starting' || phase === 'finishing' || phase === 'done';
    return (
        <div className="flex flex-col items-center gap-4 py-4">
            <button type="button" className="ta-rec-btn" data-live={live} disabled={disabled} onClick={live ? on_stop : on_start} aria-label={live ? 'Stop recording' : 'Start recording'}>
                {live ? <Square size={26} fill="currentColor" aria-hidden /> : <Mic size={30} aria-hidden />}
            </button>
            <div className="ta-rec-time" role="timer" aria-label="Elapsed recording time">
                {format_elapsed(elapsed_sec)}
            </div>
            <p className="ta-muted text-sm" aria-live="polite">
                {CAPTION[phase]}
            </p>
        </div>
    );
};
