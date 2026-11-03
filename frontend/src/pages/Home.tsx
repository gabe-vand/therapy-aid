import { FocusHero } from '@/components/home/FocusHero';
import { LastSession } from '@/components/home/LastSession';
import { QuickActions } from '@/components/home/QuickActions';
import { StalePrompts } from '@/components/home/StalePrompts';
import { PageHeader } from '@/components/ui/States';
import { format_date } from '@/services/dates';
import { useFocus } from '@/services/hooks/use-focus';
import { useSessions } from '@/services/hooks/use-sessions';
import { useStaleProblems } from '@/services/hooks/use-stale-problems';

/* Home: the focus banner first (the point of the app), then the three quick actions, any
   "still relevant?" prompts, and the last session. Each block loads and fails on its own, so one
   slow or broken request never hides the rest. */
export default function Home() {
    const focus = useFocus();
    const stale = useStaleProblems();
    const sessions = useSessions();

    return (
        <>
            <PageHeader title="Today" subtitle={format_date(new Date().toISOString(), { weekday: true })} />
            <div className="flex flex-col gap-8">
                <FocusHero
                    focus={focus.focus}
                    loading={focus.loading}
                    error={focus.error}
                    on_reload={() => void focus.reload()}
                    on_regenerate={() => void focus.regenerate()}
                    regenerating={focus.regenerating}
                    regenerate_error={focus.regenerate_error}
                />
                <QuickActions />
                <StalePrompts problems={stale.problems} busy_id={stale.busy_id} action_error={stale.action_error} on_keep={(id) => void stale.keep(id)} on_discard={stale.discard} />
                <LastSession session={sessions.sessions[0]} loading={sessions.loading} error={sessions.error} on_retry={() => void sessions.reload()} />
            </div>
        </>
    );
}
