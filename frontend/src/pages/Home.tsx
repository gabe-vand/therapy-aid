import { FocusBoard } from '@/components/home/FocusBoard';
import { HomeHeader } from '@/components/home/HomeHeader';
import { JournalThemes } from '@/components/home/JournalThemes';
import { LastSessionCard } from '@/components/home/LastSessionCard';
import { RhythmCard } from '@/components/home/RhythmCard';
import { ThreadsCard } from '@/components/home/ThreadsCard';
import { Page } from '@/components/ui/Page';
import '@/components/home/home.css';
import { useDashboard } from '@/services/hooks/use-dashboard';
import { useFocus } from '@/services/hooks/use-focus';
import { useStaleProblems } from '@/services/hooks/use-stale-problems';

/* Home, a dashboard rather than a page of prose: greeting + quick actions, the focus as a "this
   week" check-in board, then Threads (problems × sessions dot grid, stale ones with Keep/Discard)
   beside Rhythm (stat tiles), what the journal has been about, and David's suggestions from the
   last session. The focus, the dashboard and the stale actions are separate requests, so one slow
   or broken call never blanks the others. A Keep/Discard reloads the dashboard so the grid shows
   the new state. */
export default function Home() {
    const focus = useFocus();
    const dash = useDashboard();
    const stale = useStaleProblems();
    const d = dash.dashboard;
    const has_sessions = d ? d.sessions.total > 0 : dash.loading ? null : false;

    const after = (ok: boolean) => {
        if (ok) void dash.reload();
    };

    return (
        <Page width="wide">
            <div className="ta-home">
                <HomeHeader />
                <FocusBoard
                    focus={focus.focus}
                    has_sessions={has_sessions}
                    threads={d?.threads ?? []}
                    loading={focus.loading}
                    error={focus.error}
                    on_reload={() => void focus.reload()}
                    on_regenerate={() => void focus.regenerate()}
                    regenerating={focus.regenerating}
                    regenerate_error={focus.regenerate_error}
                    on_toggle={(i, day) => void focus.toggle_checkin(i, day)}
                    checkin_error={focus.checkin_error}
                />
                <div className="ta-home__band">
                    <ThreadsCard
                        dashboard={d}
                        loading={dash.loading}
                        error={dash.error}
                        on_retry={() => void dash.reload()}
                        busy_id={stale.busy_id}
                        action_error={stale.action_error}
                        on_keep={(id) => void stale.keep(id).then(after)}
                        on_discard={(id) => stale.discard(id).then(after)}
                    />
                    <RhythmCard dashboard={d} loading={dash.loading} />
                </div>
                {d && d.journal.themes.length > 0 && <JournalThemes themes={d.journal.themes} />}
                {d?.sessions.last && <LastSessionCard last={d.sessions.last} />}
            </div>
        </Page>
    );
}
