import { Link, Navigate, Outlet } from 'react-router-dom';
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
    <>
      <GlobalNav />
      <SubNavFrosted
        title="LGU Dashboard"
        action={<Link to="/lgu/queue" className="btn-primary text-sm">Review Queue</Link>}
      >
        {lguLinks.map((l) => (
          <Link key={l.to} to={l.to} className="hidden text-primary md:inline">{l.label}</Link>
        ))}
      </SubNavFrosted>
      <Outlet />
    </>
  );
}
