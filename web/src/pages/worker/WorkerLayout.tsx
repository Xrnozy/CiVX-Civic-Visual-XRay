import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { GlobalNav } from '../../components/ui/GlobalNav';
import { useProfile } from '../../hooks/useProfile';
import { publicWorkerTypeLabel } from '../../types/user';

const workerLinks = [
  { to: '/worker', label: 'Dashboard' },
  { to: '/worker/shifts', label: 'My shifts' },
];

export function WorkerLayout() {
  const { profile, ready } = useProfile();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-ink-muted-48">
        Loading…
      </div>
    );
  }

  if (!profile || profile.role !== 'street_sweeper') {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <GlobalNav />
      <div className="border-b border-hairline bg-canvas-parchment">
        <div className="page-content !py-6">
          <p className="eyebrow mb-0">Public Workers</p>
          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-ink md:text-[34px]">
                {profile.full_name}
              </h1>
              <p className="mt-1 text-sm text-ink-muted-48">
                {profile.barangay || 'Barangay not set'}
                {profile.public_worker_type && (
                  <span className="ml-2 text-ink-muted-80">
                    · {publicWorkerTypeLabel(profile.public_worker_type)}
                  </span>
                )}
                {profile.invite_id && (
                  <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    LGU verified
                  </span>
                )}
              </p>
            </div>
            <nav className="flex gap-2">
              {workerLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    location.pathname === l.to
                      ? 'bg-primary text-white'
                      : 'border border-hairline bg-canvas text-ink-muted-80 hover:border-primary'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
      <Outlet />
    </>
  );
}
