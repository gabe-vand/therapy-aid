import { AccountCard } from '@/components/settings/AccountCard';
import { AiUsageCard } from '@/components/settings/AiUsageCard';
import { AppearanceCard } from '@/components/settings/AppearanceCard';
import { ProfileCard } from '@/components/settings/ProfileCard';
import { PageHeader } from '@/components/ui/States';
import { Page } from '@/components/ui/Page';
import { useAiUsage } from '@/services/hooks/use-ai-usage';
import { useMe } from '@/services/hooks/use-me';
import { useSettings } from '@/services/hooks/use-settings';

/* Settings: appearance, the About-me profile every prompt includes, who is signed in, and what
   the AI has cost since the server booted. Each card owns its own loading and error state, so one
   failing request never blanks the others. */
export default function Settings() {
    const settings = useSettings();
    const me = useMe();
    const usage = useAiUsage();

    return (
        <Page width="reading">
            <PageHeader title="Settings" subtitle="Appearance, your profile, and what the AI is costing." />
            <div className="flex flex-col gap-5">
                <AppearanceCard />
                <ProfileCard profile={settings.profile} loading={settings.loading} error={settings.error} on_reload={settings.reload} on_save={settings.save} saving={settings.saving} save_error={settings.save_error} />
                <AccountCard me={me.me} loading={me.loading} error={me.error} on_reload={me.reload} />
                <AiUsageCard usage={usage.usage} loading={usage.loading} error={usage.error} on_reload={usage.reload} />
            </div>
        </Page>
    );
}
