import { Link, Outlet, useLocation } from 'react-router-dom';
import { paths } from '@/services/paths';
import { NAV_ITEMS, is_active, type NavItem } from './nav';
import { NavIcon } from './NavIcon';
import { ThemeToggle } from './ThemeToggle';
import './shell.css';
import './shell-mobile.css';

/* The frame every page renders inside (App.tsx uses it as the layout route) — a Linear layout.
   Desktop (≥ 768px): a fixed 240px sidebar (brand, nav, and at the bottom the theme switch and
   Settings) beside a full-bleed main area that is the scroll container. Mobile: a 48px top bar
   (brand + Settings gear), a bottom tab bar with the five main sections, and the WINDOW scrolls
   (no inner scroller — iOS keyboards fight those). Pages size themselves with <Page width>. */

const Brand = () => (
    <Link to={paths.home} className="ta-brand">
        <span aria-hidden className="ta-brand-mark" />
        therapy-aid
    </Link>
);

const current = (active: boolean) => (active ? ('page' as const) : undefined);

const SideLink = ({ item, pathname }: { item: NavItem; pathname: string }) => (
    <Link to={item.to} className="ta-side-link" aria-current={current(is_active(item, pathname))}>
        <NavIcon name={item.icon} size={16} />
        {item.label}
    </Link>
);

export default function AppShell() {
    const { pathname } = useLocation();
    const settings = NAV_ITEMS.find((item) => item.to === paths.settings)!;
    const sections = NAV_ITEMS.filter((item) => item !== settings);

    return (
        <div className="ta-shell">
            <aside className="ta-sidebar">
                <div className="ta-sidebar__brand">
                    <Brand />
                </div>
                {/* Settings stays inside the Main nav (one landmark lists every section) but sits at the bottom. */}
                <nav aria-label="Main" className="ta-sidebar__nav">
                    {sections.map((item) => (
                        <SideLink key={item.to} item={item} pathname={pathname} />
                    ))}
                    <div className="ta-sidebar__foot">
                        <div className="ta-sidebar__theme">
                            <ThemeToggle block />
                        </div>
                        <SideLink item={settings} pathname={pathname} />
                    </div>
                </nav>
            </aside>

            <div className="ta-content">
                <header className="ta-topbar">
                    <Brand />
                    <Link to={settings.to} className="ta-icon-link" aria-label="Settings" aria-current={current(is_active(settings, pathname))}>
                        <NavIcon name="settings" size={20} />
                    </Link>
                </header>

                <main className="ta-main">
                    <Outlet />
                </main>
            </div>

            <nav aria-label="Tabs" className="ta-tabs">
                {NAV_ITEMS.filter((item) => item.in_tabs).map((item) => (
                    <Link key={item.to} to={item.to} className="ta-tab" aria-current={current(is_active(item, pathname))}>
                        <NavIcon name={item.icon} size={20} />
                        {item.label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
