import { MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/Card';
import { useFocus } from '@/services/hooks/use-focus';
import { useProblems } from '@/services/hooks/use-problems';
import { starter_questions } from './starters';
import './chat-starters.css';

/* The empty conversation (no thread open, or a thread with no messages yet): a centred "Ask about
   your therapy" with suggested questions as chips, built from the focus and the problems (see
   starters.ts). The chips wait for both loads so they don't reshuffle under a finger; a failed
   load just means fewer personal chips. Tapping one asks it through the page's normal send. */
export const ChatStarters = ({ on_ask, disabled = false }: { on_ask: (question: string) => void; disabled?: boolean }) => {
    const focus = useFocus();
    const problems = useProblems();
    const ready = !focus.loading && !problems.loading;
    const questions = ready ? starter_questions({ focus: focus.focus, problems: problems.problems }) : [];

    return (
        <div className="ta-starters">
            <span className="ta-starters__icon" aria-hidden>
                <MessageSquare size={20} />
            </span>
            <h2 className="ta-starters__title">Ask about your therapy</h2>
            <p className="ta-starters__body">Answers draw on your sessions, problems, focus and journal, with David&apos;s advice weighed first.</p>
            {ready ? (
                <ul className="ta-starters__chips" aria-label="Suggested questions">
                    {questions.map((q) => (
                        <li key={q}>
                            <button type="button" className="ta-starter" onClick={() => on_ask(q)} disabled={disabled}>
                                {q}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="ta-starters__chips" aria-hidden>
                    {[180, 140, 200, 160].map((w) => (
                        <Skeleton key={w} height={32} className="rounded-full" />
                    ))}
                </div>
            )}
        </div>
    );
};
