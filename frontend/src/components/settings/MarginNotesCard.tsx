import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useMarginNotesPref } from '@/services/hooks/use-margin-notes-pref';
import './settings.css';

/* Margin notes: the switch for the companion that reads along while Gabe journals. Explains what
   it does and roughly what it costs, so turning it off is an informed choice. Per device
   (localStorage); the editor reads the same preference. */
export const MarginNotesCard = () => {
    const { pref, set_pref } = useMarginNotesPref();
    return (
        <Card aria-labelledby="margin-notes-title">
            <h2 id="margin-notes-title" className="ta-set-title">
                Margin notes
            </h2>
            <p className="ta-set-desc">
                While you write, each paragraph you finish is quietly matched against your problems (a tiny, near-free call). When one clearly fits, a short note appears beside it: what David suggested, a connection to how that thread has been going,
                or one question back. At most a few per entry, never more than one a minute.
            </p>
            <div className="ta-set-section">
                <SegmentedControl<'on' | 'off'>
                    label="Margin notes while writing"
                    options={[
                        { value: 'on', label: 'On' },
                        { value: 'off', label: 'Off' },
                    ]}
                    value={pref}
                    on_change={set_pref}
                />
            </div>
        </Card>
    );
};
