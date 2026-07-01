import { Link, Navigate, Outlet } from 'react-router-dom';
import { GlobalNav } from '../../components/ui/GlobalNav';
import { useProfile } from '../../hooks/useProfile';

export function OrganizerLayout() {
  const { profile, ready } = useProfile();

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted-48">Loading…</div>;
  }

  if (!profile || profile.role !== 'organizer') {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <GlobalNav />
      <div className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Community leader</p>
            <h1 className="text-xl font-semibold text-ink">{profile.organization_name || profile.full_name}</h1>
          </div>
          <Link to="/organizer" className="text-sm text-primary">
            My cleanup drives
          </Link>
        </div>
      </div>
      <Outlet />
    </>
  );
}
