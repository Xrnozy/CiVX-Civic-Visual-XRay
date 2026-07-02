import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOutUser, useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { MobileDemoQrPanel } from '../demo/MobileDemoQrPanel';

const publicLinks = [
  { to: '/map', label: 'Map' },
  { to: '/events', label: 'Events' },
  { to: '/analyzer', label: 'Analyzer' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/transparency', label: 'Transparency' },
];

export function GlobalNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const { profile, ready: profileReady } = useProfile();
  const [qrOpen, setQrOpen] = useState(false);

  async function handleSignOut() {
    await signOutUser();
    navigate('/login');
  }

  const displayName = profile?.full_name || user?.displayName || user?.email?.split('@')[0] || 'Account';
  const isLgu = profile && ['lgu_admin', 'lgu_staff', 'field_worker'].includes(profile.role);
  const isChecker = profile?.role === 'field_checker';
  const isOrganizer = profile?.role === 'organizer';
  const isWorker = profile?.role === 'street_sweeper';
  const roleLinksReady = !user || profileReady;
  const hideMobileDemo = location.pathname.startsWith('/mobile');

  const linkClass = (active: boolean) =>
    `global-nav-link ${active ? 'global-nav-link-active' : ''}`;

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-surface-black/95 backdrop-blur-md">
        <div className="global-nav-shell relative mx-auto max-w-[1440px] px-6 text-white">
          <Link
            to="/"
            className="absolute left-6 top-1/2 -translate-y-1/2 text-[15px] font-semibold tracking-[-0.02em] text-white"
          >
            CiVX
          </Link>

          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:flex md:gap-7">
            {publicLinks.map((l) => (
              <Link key={l.to} to={l.to} className={linkClass(location.pathname.startsWith(l.to))}>
                {l.label}
              </Link>
            ))}
            {roleLinksReady && isOrganizer && (
              <Link to="/organizer" className={linkClass(location.pathname.startsWith('/organizer'))}>
                Organizer
              </Link>
            )}
            {roleLinksReady && isWorker && (
              <Link to="/worker" className={linkClass(location.pathname.startsWith('/worker'))}>
                Public Workers
              </Link>
            )}
            {roleLinksReady && isChecker && (
              <Link to="/dispatch" className={linkClass(location.pathname.startsWith('/dispatch'))}>
                Dispatch
              </Link>
            )}
            {roleLinksReady && isLgu && (
              <Link to="/lgu" className={linkClass(location.pathname.startsWith('/lgu'))}>
                LGU
              </Link>
            )}
          </div>

          <div className="absolute right-6 top-1/2 flex -translate-y-1/2 items-center gap-2 sm:gap-3">
            {!hideMobileDemo && (
              <button type="button" className="btn-mobile-demo" onClick={() => setQrOpen(true)}>
                Click for mobile demo
              </button>
            )}
            {!ready ? (
              <span className="btn-nav-utility opacity-40" aria-hidden>
                ···
              </span>
            ) : user ? (
              <>
                <span className="hidden max-w-[140px] truncate text-xs text-white/75 sm:inline">{displayName}</span>
                <button type="button" onClick={handleSignOut} className="btn-nav-utility">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/register" className="btn-nav-utility">
                  Register
                </Link>
                <Link to="/login" className="btn-nav-utility">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
      <MobileDemoQrPanel open={qrOpen} onClose={() => setQrOpen(false)} />
    </>
  );
}
