import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { startFreshDemoSession } from './demoSession';
import { useMobileImmersiveMode } from './useMobileImmersiveMode';

import {
  mdiCalendar,
  mdiCalendarOutline,
  mdiCamera,
  mdiHome,
  mdiHomeOutline,
  mdiLeaf,
  mdiLeafCircleOutline,
  mdiMap,
  mdiMapOutline,
} from '@mdi/js';

const tabs = [
  { to: '/mobile', label: 'Home', icon: mdiHomeOutline, activeIcon: mdiHome, end: true },
  { to: '/mobile/events', label: 'Events', icon: mdiCalendarOutline, activeIcon: mdiCalendar },
  { to: '/mobile/camera', label: 'Camera', icon: mdiCamera, activeIcon: mdiCamera, center: true },
  { to: '/mobile/map', label: 'Map', icon: mdiMapOutline, activeIcon: mdiMap },
  { to: '/mobile/ecoquest', label: 'EcoQuest', icon: mdiLeafCircleOutline, activeIcon: mdiLeaf },
];

function MobileTabIcon({ path, size = 24 }: { path: string; size?: number }) {
  return (
    <svg className="mobile-tab-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export function MobileDemoLayout() {
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const { isImmersive, showEnterHint, enterImmersive, exitImmersive } = useMobileImmersiveMode(rootRef);

  useEffect(() => {
    document.documentElement.classList.add('mobile-demo-active');
    document.body.classList.add('mobile-demo-active');

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const previousTheme = themeMeta?.getAttribute('content') ?? '#0066cc';
    themeMeta?.setAttribute('content', '#ffffff');

    void startFreshDemoSession().catch(() => {});
    return () => {
      document.documentElement.classList.remove('mobile-demo-active');
      document.documentElement.classList.remove('mobile-demo-immersive');
      document.body.classList.remove('mobile-demo-active');
      themeMeta?.setAttribute('content', previousTheme);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('mobile-demo-immersive', isImmersive);
  }, [isImmersive]);

  return (
    <div ref={rootRef} className={`mobile-demo-root ${isImmersive ? 'mobile-demo-root-immersive' : ''}`}>
      <div className="mobile-immersive-controls" aria-label="Fullscreen controls">
        {showEnterHint && !isImmersive ? (
          <button
            type="button"
            className="mobile-immersive-enter"
            onClick={() => void enterImmersive()}
          >
            Tap for fullscreen
          </button>
        ) : null}
        {isImmersive ? (
          <button
            type="button"
            className="mobile-immersive-exit"
            onClick={() => void exitImmersive()}
            aria-label="Exit fullscreen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
              />
            </svg>
            Exit
          </button>
        ) : null}
      </div>
      <main className="mobile-demo-main">
        <Outlet />
      </main>
      <nav className="mobile-tab-bar" aria-label="Mobile demo navigation">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => {
              const active = isActive || (tab.to !== '/mobile' && location.pathname.startsWith(tab.to));
              return `mobile-tab-link ${tab.center ? 'mobile-tab-link-center' : ''} ${active ? 'mobile-tab-link-active' : ''}`;
            }}
          >
            {({ isActive }) => {
              const active = isActive || (tab.to !== '/mobile' && location.pathname.startsWith(tab.to));
              return (
                <>
                  <span className={tab.center ? 'mobile-tab-center-button' : undefined}>
                    <MobileTabIcon path={active ? tab.activeIcon : tab.icon} size={tab.center ? 26 : 24} />
                  </span>
                  <span>{tab.label}</span>
                </>
              );
            }}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
