import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { getDemoSessionToken } from '../demoSession';

interface MyCertificate {
  event_id: string;
  title: string;
  barangay?: string;
  service_hours: number;
  verified_at?: string;
  certificate_sent_at?: string;
}

export default function MobileAccount() {
  const { user, ready: authReady } = useAuth();
  const { profile, ready: profileReady } = useProfile();
  const [reports, setReports] = useState<Array<{ id: string; issue_type: string; created_at: string; status: string }>>([]);
  const [certificates, setCertificates] = useState<MyCertificate[]>([]);

  useEffect(() => {
    const t = getDemoSessionToken();
    if (!t) return;
    fetch(`/api/demo/sessions/${encodeURIComponent(t)}/reports`)
      .then((r) => r.json())
      .then(setReports)
      .catch(() => setReports([]));
  }, []);

  useEffect(() => {
    if (!user) {
      setCertificates([]);
      return;
    }
    api<{ certificates: MyCertificate[] }>('/api/attendance/me')
      .then((data) => setCertificates(data.certificates ?? []))
      .catch(() => setCertificates([]));
  }, [user]);

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

      {user && profile ? (
        <div className="ui-card">
          <p className="font-semibold">Volunteer certificates</p>
          {certificates.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted-48">
              Complete event check-in and check-out to earn certificates. Your organizer will email them when ready.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {certificates.map((c) => (
                <li key={c.event_id} className="rounded-lg border border-hairline px-3 py-2 text-sm">
                  <p className="font-medium text-ink">{c.title}</p>
                  <p className="text-ink-muted-48">
                    {c.service_hours} hr{c.service_hours === 1 ? '' : 's'}
                    {c.certificate_sent_at ? ' · Emailed' : ' · Pending email'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

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
