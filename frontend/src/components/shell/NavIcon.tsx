import { House, MessageSquare, Mic, NotebookPen, Settings, Target, type LucideIcon } from 'lucide-react';
import type { NavIconName } from './nav';

/* The navigation's name → icon mapping, drawn with lucide in currentColor so the active/idle
   colour comes from the link's token. Decorative — the label next to (or under) each icon is
   the accessible name. 16px in the sidebar, 20px in the mobile tab bar. */
const ICONS: Record<NavIconName, LucideIcon> = { home: House, sessions: Mic, problems: Target, journal: NotebookPen, chat: MessageSquare, settings: Settings };

export const NavIcon = ({ name, size = 20 }: { name: NavIconName; size?: number }) => {
    const Icon = ICONS[name];
    return <Icon aria-hidden size={size} strokeWidth={1.75} />;
};
