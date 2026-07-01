import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOutUser, useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';

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

  async function handleSignOut() {
    await signOutUser();
    navigate('/login');
  }

  const displayName = profile?.full_name || user?.displayName || user?.email?.split('@')[0] || 'Account';
  const isLgu = profile && ['lgu_admin', 'lgu_staff', 'field_worker'].includes(profile.role);
  const isOrganizer = profile?.role === 'organizer';
  const isWorker = profile?.role === 'street_sweeper';
  const roleLinksReady = !user || profileReady;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-surface-black/95 backdrop-blur-md">
      <div className="mx-auto flex h-11 max-w-[1440px] items-center justify-between px-6 text-xs text-white">
        <Link to="/" className="text-sm font-semibold tracking-tight text-white">
          CiVX
        </Link>
        <div className="hidden gap-6 md:flex">
          {publicLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`transition hover:text-white ${location.pathname.startsWith(l.to) ? 'text-white' : 'text-white/70'}`}
            >
              {l.label}
            </Link>
          ))}
          {roleLinksReady && isOrganizer && (
            <Link to="/organizer" className={location.pathname.startsWith('/organizer') ? 'text-white' : 'text-white/70'}>
              Organizer
            </Link>
          )}
          {roleLinksReady && isWorker && (
            <Link to="/worker" className={location.pathname.startsWith('/worker') ? 'text-white' : 'text-white/70'}>
              Public Workers
            </Link>
          )}
          {roleLinksReady && isLgu && (
            <Link to="/lgu" className={location.pathname.startsWith('/lgu') ? 'text-white' : 'text-white/70'}>
              LGU
            </Link>
          )}
        </div>
        {!ready ? (
          <span className="btn-dark-utility opacity-40" aria-hidden>
            ···
          </span>
        ) : user ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-white/80 sm:inline">{displayName}</span>
            <button type="button" onClick={handleSignOut} className="btn-dark-utility">
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Link to="/register" className="btn-dark-utility">
              Register
            </Link>
            <Link to="/login" className="btn-dark-utility">
              Sign In
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
