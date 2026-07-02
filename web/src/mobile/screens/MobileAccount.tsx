import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { getDemoSessionToken } from '../demoSession';

export default function MobileAccount() {
  const { user, ready: authReady } = useAuth();
  const { profile, ready: profileReady } = useProfile();
  const [token, setToken] = useState<string | null>(null);
  const [reports, setReports] = useState<Array<{ id: string; issue_type: string; created_at: string; status: string }>>([]);

  useEffect(() => {
    const t = getDemoSessionToken();
    setToken(t);
    if (!t) return;
    fetch(`/api/demo/sessions/${encodeURIComponent(t)}/reports`)
      .then((r) => r.json())
      .then(setReports)
      .catch(() => setReports([]));
  }, []);

  const registerHref = token
    ? `/register?session=${encodeURIComponent(token)}&next=${encodeURIComponent('/mobile/account')}`
    : '/register';
  const loginHref = token
    ? `/login?session=${encodeURIComponent(token)}&next=${encodeURIComponent('/mobile/account')}`
    : '/login';

  const displayName = profile?.full_name || user?.displayName || user?.email?.split('@')[0];

  return (
    <div className="space-y-4 p-4">
      <div className="ui-card">
        <p className="ui-card-title">Demo session</p>
        <p className="mt-2 break-all text-xs text-ink-muted-48">{token || 'Initializing…'}</p>
        <p className="mt-2 text-sm text-ink-muted-48">
          Reports from this phone are tagged to your demo session. Link a CiVX account to keep your progress.
        </p>
      </div>

      <div className="ui-card">
        <p className="ui-card-title">Your account</p>
        {!authReady || (user && !profileReady) ? (
          <p className="mt-2 text-sm text-ink-muted-48">Loading account…</p>
        ) : user && profile ? (
          <div className="mt-2 space-y-2 text-sm">
            <p className="font-semibold text-ink">{displayName}</p>
            <p className="text-ink-muted-48">{user.email}</p>
            <p className="capitalize text-ink-muted-48">{profile.role.replace(/_/g, ' ')}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-ink-muted-48">
              No account linked yet. Register or sign in to attach this session to your profile.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to={registerHref} className="btn-primary text-sm">
                Create account
              </Link>
              <Link to={loginHref} className="btn-secondary-pill text-sm">
                Sign in
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="ui-card">
        <p className="font-semibold">Your demo reports</p>
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
