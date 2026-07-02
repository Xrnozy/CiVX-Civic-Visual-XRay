import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface CaseRow {
  id: string;
  dispatch_status: string;
  assigned_at: string;
  incidents?: {
    id: string;
    primary_issue_type: string;
    status: string;
    latitude?: number;
    longitude?: number;
    barangay?: string;
  };
}

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Assigned',
  on_the_way: 'On the way',
  checking_site: 'Checking site',
  verified: 'Verified',
  needs_action: 'Needs action',
  resolved: 'Resolved',
};

export default function DispatchDashboard() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const q = filter ? `?status=${encodeURIComponent(filter)}` : '';
    api<CaseRow[]>(`/api/dispatch/cases${q}`)
      .then(setCases)
      .catch(() => setCases([]));
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`map-layer-btn ${!filter ? 'map-layer-btn-active' : ''}`} onClick={() => setFilter('')}>
          All
        </button>
        {Object.keys(STATUS_LABELS).map((s) => (
          <button
            key={s}
            type="button"
            className={`map-layer-btn ${filter === s ? 'map-layer-btn-active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {cases.length === 0 ? (
        <div className="ui-card text-sm text-ink-muted-48">No assigned cases yet. LGU will route verified reports here.</div>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => {
            const inc = c.incidents;
            return (
              <li key={c.id}>
                <Link to={`/dispatch/cases/${c.id}`} className="ui-card block transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-primary">
                        {STATUS_LABELS[c.dispatch_status] || c.dispatch_status}
                      </p>
                      <h3 className="mt-1 font-semibold capitalize text-ink">
                        {inc?.primary_issue_type?.replace(/_/g, ' ') || 'Case'}
                      </h3>
                      <p className="text-sm text-ink-muted-48">{inc?.barangay || 'Location pending'}</p>
                    </div>
                    <span className="text-xs text-ink-muted-48">{new Date(c.assigned_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
