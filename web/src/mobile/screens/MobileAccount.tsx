import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { getDemoSessionToken } from '../demoSession';

export default function MobileAccount() {
  const { user, ready: authReady } = useAuth();
  const { profile, ready: profileReady } = useProfile();
  const [reports, setReports] = useState<Array<{ id: string; issue_type: string; created_at: string; status: string }>>([]);

  useEffect(() => {
    const t = getDemoSessionToken();
    if (!t) return;
    fetch(`/api/demo/sessions/${encodeURIComponent(t)}/reports`)
      .then((r) => r.json())
      .then(setReports)
      .catch(() => setReports([]));
  }, []);

  const displayName = profile?.full_name || user?.displayName || user?.email?.split('@')[0];

  return (
    <div className="space-y-4 p-4">
      <div className="ui-card">
        <p className="ui-card-title">Your account</p>
        {!authReady || (user && !profileReady) ? (
          <p className="mt-2 text-sm text-ink-muted-48">Loading…</p>
        ) : user && profile ? (
          <div className="mt-2 space-y-2 text-sm">
            <p className="font-semibold text-ink">{displayName}</p>
            <p className="text-ink-muted-48">{user.email}</p>
            <p className="capitalize text-ink-muted-48">{profile.role.replace(/_/g, ' ')}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-ink-muted-48">
              Sign in or create an account to save reports and track volunteer activity.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/register?next=/mobile/account" className="btn-primary text-sm">
                Create account
              </Link>
              <Link to="/login?next=/mobile/account" className="btn-secondary-pill text-sm">
                Sign in
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="ui-card">
        <p className="font-semibold">Your reports</p>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted-48">No reports yet. Try Report or Camera.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="rounded-lg border border-hairline px-3 py-2 text-sm">
                <span className="capitalize">{r.issue_type.replace(/_/g, ' ')}</span>
                <span className="text-ink-muted-48"> · {r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
