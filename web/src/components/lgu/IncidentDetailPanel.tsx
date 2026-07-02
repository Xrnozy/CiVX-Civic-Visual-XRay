import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ButtonPrimary, ButtonSecondaryPill } from '../ui/Buttons';
import { ImageGalleryOverlay } from '../ui/ImageGalleryOverlay';
import { ReportEvidencePhoto } from '../map/ReportEvidencePhoto';
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
  photo_url?: string;
  photo_urls?: string[];
  address_text?: string;
  ai_suggested_type?: string;
  ai_confidence?: number;
  ai_bounding_box?: Record<string, unknown> | null;
  ai_severity_score?: number;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Checker {
  id: string;
  full_name: string;
  email?: string;
}

interface DispatchRec {
  department_id?: string;
  department_name?: string;
  dispatch_label?: string;
}

interface DispatchActivity {
  id: string;
  dispatch_status?: string;
  notes?: string;
  created_at: string;
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

function reportImages(report: Report): string[] {
  const list = Array.isArray(report.photo_urls) ? report.photo_urls.filter(Boolean) : [];
  if (list.length > 0) return list;
  return report.photo_url ? [report.photo_url] : [];
}

function allReportImages(reports: Report[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const report of reports) {
    for (const url of reportImages(report)) {
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
  }
  return urls;
}

export function IncidentDetailPanel({ incident, departments, onAction, onClose }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [gallery, setGallery] = useState<{ images: string[]; index: number } | null>(null);
  const [assignDept, setAssignDept] = useState(incident.suggested_department_id ?? '');
  const [checkers, setCheckers] = useState<Checker[]>([]);
  const [selectedChecker, setSelectedChecker] = useState('');
  const [dispatchRec, setDispatchRec] = useState<DispatchRec | null>(null);
  const [dispatchActivity, setDispatchActivity] = useState<DispatchActivity[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAssignDept(incident.assigned_department_id ?? incident.suggested_department_id ?? '');
    setLoadingReports(true);
    api<Report[]>(`/api/incidents/${incident.id}/reports`)
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoadingReports(false));

    api<DispatchRec>(`/api/incidents/${incident.id}/dispatch-recommendation`)
      .then((rec) => {
        setDispatchRec(rec);
        if (!incident.assigned_department_id && rec.department_id) {
          setAssignDept(rec.department_id);
        }
      })
      .catch(() => setDispatchRec(null));

    api<{ activity: DispatchActivity[] }>(`/api/incidents/${incident.id}/dispatch-status`)
      .then((d) => setDispatchActivity(d.activity || []))
      .catch(() => setDispatchActivity([]));

    api<Checker[]>('/api/dispatch/checkers')
      .then(setCheckers)
      .catch(() => setCheckers([]));
  }, [incident.id, incident.assigned_department_id, incident.suggested_department_id]);

  const suggestedDept = departments.find((d) => d.id === incident.suggested_department_id);
  const assignedDept = departments.find((d) => d.id === incident.assigned_department_id);
  const avgConfidence = reports.length
    ? reports.reduce((sum, r) => sum + (r.ai_confidence ?? 0), 0) / reports.length
    : null;
  const submittedBarangay = reports.find((r) => r.address_text?.trim())?.address_text?.trim();
  const displayBarangay = incident.barangay ?? submittedBarangay ?? 'Unknown';
  const galleryImages = useMemo(() => allReportImages(reports), [reports]);

  function openGallery(url: string) {
    const index = galleryImages.indexOf(url);
    if (index >= 0) setGallery({ images: galleryImages, index });
  }

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
  const canDispatchChecker = ['verified', 'assigned'].includes(incident.status);
  const canDispatch = incident.status === 'assigned';
  const canResolve = ['assigned', 'ongoing', 'verified'].includes(incident.status);

  return (
    <div className="store-utility-card relative flex h-full flex-col">
      {gallery ? (
        <ImageGalleryOverlay
          contained
          className="absolute inset-0 z-50 rounded-[inherit]"
          images={gallery.images}
          index={gallery.index}
          onClose={() => setGallery(null)}
          onChange={(index) => setGallery((current) => (current ? { ...current, index } : null))}
        />
      ) : null}
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
            {reports.map((r) => {
              const thumb = reportImages(r)[0];
              return (
                <div key={r.id} className="flex gap-3 overflow-hidden rounded-[11px] border border-hairline p-3">
                  {thumb ? (
                    <ReportEvidencePhoto
                      url={thumb}
                      bbox={r.ai_bounding_box}
                      label={r.ai_suggested_type ? formatLabel(r.ai_suggested_type) : formatLabel(r.issue_type)}
                      onClick={() => openGallery(thumb)}
                      className="rounded-[8px] border border-hairline"
                      imageClassName="h-16 w-16 object-cover transition hover:opacity-90"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold capitalize">{formatLabel(r.issue_type)}</p>
                    {r.description ? <p className="mt-1 line-clamp-3 text-xs text-ink-muted-80">{r.description}</p> : null}
                    <p className="mt-1 text-xs text-ink-muted-48">
                      {r.ai_confidence != null && `AI ${(r.ai_confidence * 100).toFixed(0)}%`}
                      {r.ai_suggested_type && ` · ${formatLabel(r.ai_suggested_type)}`}
                      {` · ${timeAgo(r.created_at)}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dispatchRec?.dispatch_label && (
        <div className="mt-4 rounded-[11px] border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Recommended field check</p>
          <p className="mt-1 font-medium text-ink">{dispatchRec.dispatch_label}</p>
          {dispatchRec.department_name ? (
            <p className="text-xs text-ink-muted-48">{dispatchRec.department_name}</p>
          ) : null}
        </div>
      )}

      {dispatchActivity.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted-48">Dispatch progress</p>
          <ul className="mt-2 space-y-2">
            {dispatchActivity.map((a) => (
              <li key={a.id} className="text-xs text-ink-muted-80">
                <span className="font-medium capitalize">{a.dispatch_status?.replace(/_/g, ' ') || 'Update'}</span>
                {a.notes ? ` — ${a.notes}` : ''}
                <span className="text-ink-muted-48"> · {timeAgo(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canDispatchChecker && checkers.length > 0 && (
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-widest text-ink-muted-48">
            Assign field checker
          </label>
          <select
            className="filter-select mt-2 w-full"
            value={selectedChecker}
            onChange={(e) => setSelectedChecker(e.target.value)}
          >
            <option value="">Select field checker…</option>
            {checkers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} {c.email ? `(${c.email})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

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
        {canDispatchChecker && selectedChecker && (
          <ButtonPrimary
            disabled={busy}
            onClick={() =>
              run(() =>
                api(
                  `/api/incidents/${incident.id}/dispatch-checker?checker_user_id=${encodeURIComponent(selectedChecker)}${assignDept ? `&department_id=${encodeURIComponent(assignDept)}` : ''}`,
                  { method: 'POST' },
                ),
              )
            }
          >
            Send to field checker
          </ButtonPrimary>
        )}
        {canDispatch && (
          <ButtonPrimary disabled={busy} onClick={() => run(() => api(`/api/incidents/${incident.id}/dispatch`, { method: 'POST' }))}>
            Mark en route
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
            to={`/map?lat=${incident.latitude}&lng=${incident.longitude}`}
            className="btn-secondary-pill text-sm"
          >
            View on map
          </Link>
        )}
      </div>
    </div>
  );
}
