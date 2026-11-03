import { Link, Outlet, useLocation } from 'react-router-dom';
import { paths } from '@/services/paths';
import { NAV_ITEMS, is_active } from './nav';
import { NavIcon } from './NavIcon';
import './shell.css';

/* The frame every page renders inside (App.tsx uses it as the layout route). Desktop (≥ 768px):
   a left sidebar with the brand and every nav item. Mobile: a top brand bar with a Settings gear
   and a bottom tab bar with the five main sections. The page itself renders in a centred
   ~860px content column via <Outlet />. */

const Brand = () => (
    <Link to={paths.home} className="ta-brand inline-flex items-center text-[17px]">
        <span aria-hidden className="ta-brand-mark" />
        therapy-aid
    </Link>
);

const current = (active: boolean) => (active ? ('page' as const) : undefined);

export default function AppShell() {
    const { pathname } = useLocation();
    const settings = NAV_ITEMS.find((item) => item.to === paths.settings)!;

    return (
        <div className="ta-shell md:flex">
            <aside className="ta-sidebar sticky top-0 hidden h-screen w-60 shrink-0 flex-col px-4 py-6 md:flex">
                <div className="px-2">
                    <Brand />
                </div>
                <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
                    {NAV_ITEMS.map((item) => (
                        <Link key={item.to} to={item.to} className="ta-side-link" aria-current={current(is_active(item, pathname))}>
                            <NavIcon name={item.icon} size={20} />
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </aside>

            <div className="min-w-0 flex-1">
                <header className="ta-topbar sticky top-0 z-20 md:hidden">
                    <div className="flex h-14 items-center justify-between px-4">
                        <Brand />
                        <Link to={settings.to} className="ta-icon-link" aria-label="Settings" aria-current={current(is_active(settings, pathname))}>
                            <NavIcon name="settings" />
                        </Link>
                    </div>
                </header>

                <main className="ta-main mx-auto w-full max-w-[860px] px-4 pt-6 md:px-8 md:pt-10">
                    <Outlet />
                </main>
            </div>

            <nav aria-label="Tabs" className="ta-tabs fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 md:hidden">
                {NAV_ITEMS.filter((item) => item.in_tabs).map((item) => (
                    <Link key={item.to} to={item.to} className="ta-tab" aria-current={current(is_active(item, pathname))}>
                        <NavIcon name={item.icon} />
                        {item.label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
