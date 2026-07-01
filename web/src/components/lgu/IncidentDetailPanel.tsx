import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ButtonPrimary, ButtonSecondaryPill } from '../ui/Buttons';
import { api } from '../../lib/api';
import { IncidentStatusBadge, PriorityBadge, SourceBadge, formatLabel } from './IncidentBadges';

export interface Incident {
  id: string;
  primary_issue_type: string;
  status: string;
  triage_priority?: number;
  severity_score?: number;
  report_count?: number;
  barangay?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
  suggested_department_id?: string;
  assigned_department_id?: string;
  ai_summary?: string;
  created_at: string;
  verified_at?: string;
  resolved_at?: string;
}

interface Report {
  id: string;
  issue_type: string;
  description?: string;
  photo_url: string;
  address_text?: string;
  ai_suggested_type?: string;
  ai_confidence?: number;
  ai_severity_score?: number;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Props {
  incident: Incident;
  departments: Department[];
  onAction: () => void;
  onClose?: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_FLOW = ['detected', 'pending_review', 'verified', 'assigned', 'ongoing', 'resolved'];

export function IncidentDetailPanel({ incident, departments, onAction, onClose }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [assignDept, setAssignDept] = useState(incident.suggested_department_id ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAssignDept(incident.assigned_department_id ?? incident.suggested_department_id ?? '');
    setLoadingReports(true);
    api<Report[]>(`/api/incidents/${incident.id}/reports`)
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoadingReports(false));
  }, [incident.id, incident.assigned_department_id, incident.suggested_department_id]);

  const suggestedDept = departments.find((d) => d.id === incident.suggested_department_id);
  const assignedDept = departments.find((d) => d.id === incident.assigned_department_id);
  const avgConfidence = reports.length
    ? reports.reduce((sum, r) => sum + (r.ai_confidence ?? 0), 0) / reports.length
    : null;
  const submittedBarangay = reports.find((r) => r.address_text?.trim())?.address_text?.trim();
  const displayBarangay = incident.barangay ?? submittedBarangay ?? 'Unknown';

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      onAction();
    } finally {
      setBusy(false);
    }
  }

  const canVerify = ['detected', 'pending_review'].includes(incident.status);
  const canAssign = ['verified', 'pending_review', 'detected'].includes(incident.status);
  const canDispatch = incident.status === 'assigned';
  const canResolve = ['assigned', 'ongoing', 'verified'].includes(incident.status);

  return (
    <div className="store-utility-card flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Incident Detail</p>
          <h2 className="mt-1 text-[21px] font-semibold capitalize text-ink">
            {formatLabel(incident.primary_issue_type)}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <IncidentStatusBadge status={incident.status} />
            <PriorityBadge priority={incident.triage_priority} />
            <SourceBadge source={incident.source} />
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-sm text-ink-muted-48 hover:text-ink">
            Close
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1">
        {STATUS_FLOW.map((step, i) => {
          const idx = STATUS_FLOW.indexOf(incident.status);
          const active = i <= idx;
          return (
            <div key={step} className="flex items-center gap-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  active ? 'bg-primary text-white' : 'bg-canvas-parchment text-ink-muted-48'
                }`}
              >
                {formatLabel(step)}
              </span>
              {i < STATUS_FLOW.length - 1 && <span className="text-ink-muted-48">›</span>}
            </div>
          );
        })}
      </div>

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted-48">Severity</dt>
          <dd className="font-semibold">{incident.severity_score ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-ink-muted-48">Reports merged</dt>
          <dd className="font-semibold">{incident.report_count ?? 1}</dd>
        </div>
        <div>
          <dt className="text-ink-muted-48">Barangay</dt>
          <dd className="font-semibold">{displayBarangay}</dd>
        </div>
        <div>
          <dt className="text-ink-muted-48">Reported</dt>
          <dd className="font-semibold">{timeAgo(incident.created_at)}</dd>
        </div>
        {avgConfidence != null && (
          <div>
            <dt className="text-ink-muted-48">AI confidence (avg)</dt>
            <dd className="font-semibold">{(avgConfidence * 100).toFixed(0)}%</dd>
          </div>
        )}
        {suggestedDept && (
          <div>
            <dt className="text-ink-muted-48">Suggested dept</dt>
            <dd className="font-semibold">{suggestedDept.name}</dd>
          </div>
        )}
        {assignedDept && (
          <div>
            <dt className="text-ink-muted-48">Assigned dept</dt>
            <dd className="font-semibold">{assignedDept.name}</dd>
          </div>
        )}
      </dl>

      {incident.ai_summary && (
        <div className="mt-4 rounded-[11px] bg-canvas-parchment p-4 text-sm text-ink-muted-80">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">AI Summary</p>
          <p className="mt-2">{incident.ai_summary}</p>
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted-48">Linked Reports</p>
        {loadingReports ? (
          <p className="mt-2 text-sm text-ink-muted-48">Loading reports…</p>
        ) : reports.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted-48">No linked reports.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="flex gap-3 rounded-[11px] border border-hairline p-3">
                {r.photo_url && (
                  <img
                    src={r.photo_url}
                    alt="Report"
                    className="h-16 w-16 shrink-0 rounded-sm object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold capitalize">{formatLabel(r.issue_type)}</p>
                  {r.description && <p className="mt-1 text-xs text-ink-muted-80">{r.description}</p>}
                  <p className="mt-1 text-xs text-ink-muted-48">
                    {r.ai_confidence != null && `AI ${(r.ai_confidence * 100).toFixed(0)}%`}
                    {r.ai_suggested_type && ` · ${formatLabel(r.ai_suggested_type)}`}
                    {` · ${timeAgo(r.created_at)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canAssign && (
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-widest text-ink-muted-48">
            Assign department
          </label>
          <select
            className="filter-select mt-2 w-full"
            value={assignDept}
            onChange={(e) => setAssignDept(e.target.value)}
          >
            <option value="">Select department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 border-t border-hairline pt-4">
        {canVerify && (
          <>
            <ButtonPrimary disabled={busy} onClick={() => run(() => api(`/api/incidents/${incident.id}/verify`, { method: 'POST' }))}>
              Verify
            </ButtonPrimary>
            <ButtonSecondaryPill
              disabled={busy}
              onClick={() => run(() => api(`/api/incidents/${incident.id}/reject`, { method: 'POST' }))}
            >
              Reject
            </ButtonSecondaryPill>
          </>
        )}
        {canAssign && assignDept && (
          <ButtonPrimary
            disabled={busy}
            onClick={() =>
              run(() =>
                api(`/api/incidents/${incident.id}/assign?department_id=${encodeURIComponent(assignDept)}`, {
                  method: 'POST',
                }),
              )
            }
          >
            Assign
          </ButtonPrimary>
        )}
        {canDispatch && (
          <ButtonPrimary disabled={busy} onClick={() => run(() => api(`/api/incidents/${incident.id}/dispatch`, { method: 'POST' }))}>
            Dispatch
          </ButtonPrimary>
        )}
        {canResolve && (
          <ButtonPrimary
            disabled={busy}
            onClick={() =>
              run(() =>
                api(`/api/incidents/${incident.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ status: 'resolved' }),
                }),
              )
            }
          >
            Resolve
          </ButtonPrimary>
        )}
        <ButtonSecondaryPill
          disabled={busy}
          onClick={() => run(() => api(`/api/incidents/${incident.id}/triage`, { method: 'POST' }))}
        >
          Re-triage
        </ButtonSecondaryPill>
        <ButtonSecondaryPill
          disabled={busy}
          onClick={() => run(() => api(`/api/analytics/incidents/${incident.id}/summary`, { method: 'POST' }))}
        >
          AI Summary
        </ButtonSecondaryPill>
        {incident.latitude != null && incident.longitude != null && (
          <Link
            to={`/lgu/map?lat=${incident.latitude}&lng=${incident.longitude}`}
            className="btn-secondary-pill text-sm"
          >
            View on map
          </Link>
        )}
      </div>
    </div>
  );
}
