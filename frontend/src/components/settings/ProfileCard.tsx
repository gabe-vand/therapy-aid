import { useState } from 'react';
import type { Profile } from '@therapy-aid/shared';
import { Button } from '@/components/ui/Button';
import { Card, Loading, Skeleton } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/States';
import { relative_time } from '@/services/dates';

/* The "About me" editor. The draft is null until the user types, so the textarea shows the saved
   copy and "dirty" is simply draft !== saved — no sync effect to drift out of step. Saving puts
   the server's copy back and drops the draft, which flips the status line to "Saved just now". */

type Props = { profile: Profile | null; loading: boolean; error: string | null; on_reload: () => void; on_save: (text: string) => Promise<boolean>; saving: boolean; save_error: string | null };

export const ProfileCard = ({ profile, loading, error, on_reload, on_save, saving, save_error }: Props) => {
    const [draft, set_draft] = useState<string | null>(null);

    const saved_text = profile?.profile ?? '';
    const value = draft ?? saved_text;
    const dirty = draft !== null && draft !== saved_text;

    const save = async () => {
        if (await on_save(value)) set_draft(null);
    };

    const status = saving ? 'Saving…' : dirty ? 'Unsaved changes' : profile?.updated_at ? `Saved ${relative_time(profile.updated_at)}` : 'Not saved yet';

    return (
        <Card aria-labelledby="profile-title">
            <h2 id="profile-title" className="text-lg font-semibold">
                About me
            </h2>
            <p className="ta-muted mt-1 text-[15px]">
                Included in every summary, focus, insight and chat answer, so the AI knows who it is talking about. Write it in your own words: what is going on, what you are working on, how you like to be spoken to.
            </p>

            <div className="mt-4">
                {loading ? (
                    <Loading label="Loading profile…">
                        <Skeleton lines={5} height={18} />
                    </Loading>
                ) : error !== null ? (
                    <ErrorState message={error} on_retry={on_reload} />
                ) : (
                    <>
                        <textarea aria-label="About me" className="ta-input" rows={12} value={value} onChange={(e) => set_draft(e.target.value)} style={{ minHeight: 220, resize: 'vertical', lineHeight: 1.55 }} />
                        {save_error && (
                            <div className="mt-3">
                                <ErrorState message={save_error} />
                            </div>
                        )}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <span role="status" className="ta-muted text-[14px]">
                                {status}
                            </span>
                            <Button variant="primary" onClick={save} disabled={!dirty || saving}>
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
};
