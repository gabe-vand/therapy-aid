import type { SessionSource, SessionStatus } from '@therapy-aid/shared';
import './session-steps.css';

/* Where a session is in the pipeline: Uploaded → Transcribing → Summarizing → Ready. Notes skip
   transcription, so their stepper has three steps. A failed session marks the step it died on:
   Ready when the summary already exists (only the problem updates failed), Summarizing when a
   transcript exists or it is notes, otherwise Transcribing. */

type StepKey = 'uploaded' | 'transcribing' | 'summarizing' | 'ready';
const LABELS: Record<StepKey, string> = { uploaded: 'Uploaded', transcribing: 'Transcribing', summarizing: 'Summarizing', ready: 'Ready' };

type Props = { status: SessionStatus; source: SessionSource; has_transcript?: boolean; has_summary?: boolean };

export const ProcessingStepper = ({ status, source, has_transcript = false, has_summary = false }: Props) => {
    const steps: StepKey[] = source === 'recording' ? ['uploaded', 'transcribing', 'summarizing', 'ready'] : ['uploaded', 'summarizing', 'ready'];
    const failed_at: StepKey = has_summary ? 'ready' : source === 'recording' && !has_transcript ? 'transcribing' : 'summarizing';
    // 'recording' (never finalized) sits before the first step.
    const position = status === 'failed' ? steps.indexOf(failed_at) : status === 'recording' ? -1 : steps.indexOf(status as StepKey);

    return (
        <ol className="ta-steps" aria-label="Processing progress">
            {steps.map((key, i) => {
                const state = i < position ? 'done' : i === position ? (status === 'failed' ? 'failed' : status === 'ready' ? 'done' : 'current') : 'todo';
                return (
                    <li key={key} className="ta-step" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
                        <span className="ta-step-dot" aria-hidden>
                            {state === 'done' ? '✓' : state === 'failed' ? '!' : i + 1}
                        </span>
                        {LABELS[key]}
                    </li>
                );
            })}
        </ol>
    );
};
