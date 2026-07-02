import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { GlobalNav } from '../../components/ui/GlobalNav';
import { SubNavFrosted } from '../../components/ui/SubNavFrosted';
import { useProfile } from '../../hooks/useProfile';

const baseLguLinks = [
  { to: '/lgu', label: 'Overview' },
  { to: '/lgu/queue', label: 'Queue' },
  { to: '/lgu/map', label: 'Map' },
  { to: '/lgu/cleanup', label: 'Cleanup' },
  { to: '/lgu/worker-invites', label: 'Worker QR' },
  { to: '/lgu/attendance', label: 'Attendance' },
  { to: '/lgu/ecoquest', label: 'EcoQuest' },
  { to: '/lgu/analytics', label: 'Analytics' },
];

const adminOnlyLinks = [{ to: '/lgu/staff', label: 'Staff access' }];

const LGU_ROLES = new Set(['lgu_admin', 'lgu_staff', 'field_worker']);

export function LGULayout() {
  const { profile, ready } = useProfile();
  const location = useLocation();
  const isMapRoute = location.pathname === '/lgu/map';

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-ink-muted-48">
        Loading…
      </div>
    );
  }

  if (!profile || !LGU_ROLES.has(profile.role)) {
    return <Navigate to="/login" replace />;
  }

  const lguLinks = profile.role === 'lgu_admin' ? [...baseLguLinks, ...adminOnlyLinks] : baseLguLinks;

  return (
    <div className={isMapRoute ? 'flex h-dvh flex-col overflow-hidden bg-canvas' : undefined}>
      <GlobalNav />
      {!isMapRoute ? (
        <SubNavFrosted
          title="LGU Dashboard"
          action={<Link to="/lgu/queue" className="btn-primary text-sm">Review Queue</Link>}
        >
          {lguLinks.map((l) => (
            <Link key={l.to} to={l.to} className="hidden text-primary md:inline">{l.label}</Link>
          ))}
        </SubNavFrosted>
      ) : null}
      <div className={isMapRoute ? 'flex min-h-0 flex-1 flex-col' : undefined}>
        <Outlet />
      </div>
    </div>
  );
}
