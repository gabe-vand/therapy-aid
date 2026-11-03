import { Monitor, Moon, Sun } from 'lucide-react';
import { SegmentedControl, type SegmentOption } from '@/components/ui/SegmentedControl';
import { useTheme } from '@/services/hooks/use-theme';
import type { ThemePreference } from '@/services/theme';

/* The light / dark / system switch. Compact (icons only) at the bottom of the sidebar; with
   `show_labels` it spells the options out (Settings → Appearance). Every mounted toggle stays in
   sync through useTheme's change event. */

const OPTIONS: SegmentOption<ThemePreference>[] = [
    { value: 'light', label: 'Light', icon: <Sun aria-hidden /> },
    { value: 'dark', label: 'Dark', icon: <Moon aria-hidden /> },
    { value: 'system', label: 'System', icon: <Monitor aria-hidden /> },
];

export const ThemeToggle = ({ show_labels = false, block = false }: { show_labels?: boolean; block?: boolean }) => {
    const { preference, set_preference } = useTheme();
    return <SegmentedControl label="Theme" options={OPTIONS} value={preference} on_change={set_preference} icon_only={!show_labels} block={block} />;
};
