import { paths } from '@/services/paths';

/* The shell's navigation contract. Desktop shows every item in the sidebar; mobile shows the
   `in_tabs` five in the bottom tab bar and keeps Settings behind the gear in the top bar.
   An item is active on its own path and everything under it (/sessions/4 lights Sessions),
   except Home, which is active only on "/". */

export type NavIconName = 'home' | 'sessions' | 'problems' | 'journal' | 'chat' | 'settings';

export interface NavItem {
    label: string;
    to: string;
    icon: NavIconName;
    in_tabs: boolean;
}

export const NAV_ITEMS: NavItem[] = [
    { label: 'Home', to: paths.home, icon: 'home', in_tabs: true },
    { label: 'Sessions', to: paths.sessions, icon: 'sessions', in_tabs: true },
    { label: 'Problems', to: paths.problems, icon: 'problems', in_tabs: true },
    { label: 'Journal', to: paths.journal, icon: 'journal', in_tabs: true },
    { label: 'Chat', to: paths.chat, icon: 'chat', in_tabs: true },
    { label: 'Settings', to: paths.settings, icon: 'settings', in_tabs: false },
];

/* Whether `item` is the current section for `pathname`. */
export const is_active = (item: NavItem, pathname: string): boolean => {
    if (item.to === paths.home) return pathname === paths.home;
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
};
