import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { startFreshDemoSession } from './demoSession';

const tabs = [
  { to: '/mobile', label: 'Home', end: true },
  { to: '/mobile/events', label: 'Events' },
  { to: '/mobile/camera', label: 'Camera' },
  { to: '/mobile/map', label: 'Map' },
  { to: '/mobile/ecoquest', label: 'EcoQuest' },
];

export function MobileDemoLayout() {
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.add('mobile-demo-active');
    document.body.classList.add('mobile-demo-active');

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const previousTheme = themeMeta?.getAttribute('content') ?? '#0066cc';
    themeMeta?.setAttribute('content', '#ffffff');

    void startFreshDemoSession().catch(() => {});
    return () => {
      document.documentElement.classList.remove('mobile-demo-active');
      document.body.classList.remove('mobile-demo-active');
      themeMeta?.setAttribute('content', previousTheme);
    };
  }, []);

  return (
    <div className="mobile-demo-root">
      <header className="mobile-demo-header">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">CiVX Mobile</p>
          <p className="text-sm font-semibold text-ink">Demo</p>
        </div>
        <NavLink to="/mobile/account" className="text-xs font-medium text-primary">
          Account
        </NavLink>
      </header>
      <main className="mobile-demo-main">
        <Outlet />
      </main>
      <nav className="mobile-tab-bar" aria-label="Mobile demo navigation">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `mobile-tab-link ${isActive || (tab.to !== '/mobile' && location.pathname.startsWith(tab.to)) ? 'mobile-tab-link-active' : ''}`
            }
          >
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
