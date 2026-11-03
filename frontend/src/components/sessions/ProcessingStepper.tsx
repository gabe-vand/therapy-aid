import type { SessionSource, SessionStatus } from '@therapy-aid/shared';
import './sessions.css';

/* Where a session is in the pipeline: Uploaded → Transcribing → Summarizing → Ready. Notes skip
   transcription, so their stepper has three steps. A failed session marks the step it died on
   (summarizing if a transcript already exists, otherwise transcribing for recordings). */

type StepKey = 'uploaded' | 'transcribing' | 'summarizing' | 'ready';
const LABELS: Record<StepKey, string> = { uploaded: 'Uploaded', transcribing: 'Transcribing', summarizing: 'Summarizing', ready: 'Ready' };

type Props = { status: SessionStatus; source: SessionSource; has_transcript?: boolean };

export const ProcessingStepper = ({ status, source, has_transcript = false }: Props) => {
    const steps: StepKey[] = source === 'recording' ? ['uploaded', 'transcribing', 'summarizing', 'ready'] : ['uploaded', 'summarizing', 'ready'];
    const failed_at: StepKey = source === 'recording' && !has_transcript ? 'transcribing' : 'summarizing';
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
