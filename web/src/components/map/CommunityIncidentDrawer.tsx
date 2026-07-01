import { IncidentStatusBadge, formatLabel } from '../lgu/IncidentBadges';

export interface CommunityIncidentDetail {
  id: string;
  primary_issue_type: string;
  status: string;
  severity_score?: number;
  report_count?: number;
  barangay?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
  submitter_type?: string;
  ai_summary?: string;
  created_at?: string;
  verified_at?: string;
  resolved_at?: string;
}

export interface CommunityIncidentReport {
  id: string;
  issue_type: string;
  description?: string;
  photo_url?: string;
  photo_urls?: string[];
  ai_suggested_type?: string;
  ai_confidence?: number;
  ai_bounding_box?: Record<string, unknown> | null;
  ai_severity_score?: number;
  status?: string;
  created_at?: string;
  reporter_user_id?: string;
  latitude?: number;
  longitude?: number;
  address_text?: string;
  submitter_type?: string;
}

interface Props {
  incident: CommunityIncidentDetail;
  reports: CommunityIncidentReport[];
  loading: boolean;
  onClose: () => void;
}

function asLocalTime(iso?: string): string {
  if (!iso) return 'Unknown';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function asCoord(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Unknown';
  return value.toFixed(6);
}

function firstImage(report: CommunityIncidentReport): string | undefined {
  if (Array.isArray(report.photo_urls) && report.photo_urls.length > 0) {
    return report.photo_urls[0];
  }
  return report.photo_url;
}

function reportImages(report: CommunityIncidentReport): string[] {
  const list = Array.isArray(report.photo_urls) ? report.photo_urls.filter(Boolean) : [];
  if (list.length > 0) return list;
  return report.photo_url ? [report.photo_url] : [];
}

function allImages(reports: CommunityIncidentReport[]): string[] {
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

function submitterLabel(value?: string): string {
  if (value === 'lgu') return 'LGU';
  return 'Community member';
}

export function CommunityIncidentDrawer({ incident, reports, loading, onClose }: Props) {
  const gallery = allImages(reports);

  return (
    <aside className="store-utility-card flex h-full min-h-[70vh] flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Incident details</p>
          <h2 className="mt-1 text-[21px] font-semibold text-ink">{formatLabel(incident.primary_issue_type)}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <IncidentStatusBadge status={incident.status} />
            <span className="inline-flex rounded-full bg-canvas-parchment px-3 py-1 text-xs text-ink-muted-80">
              {submitterLabel(incident.submitter_type)}
            </span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-ink-muted-48 hover:text-ink">
          Close
        </button>
      </div>

      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-ink-muted-48">Latitude</p>
          <p className="font-semibold text-ink">{asCoord(incident.latitude)}</p>
        </div>
        <div>
          <p className="text-ink-muted-48">Longitude</p>
          <p className="font-semibold text-ink">{asCoord(incident.longitude)}</p>
        </div>
        <div>
          <p className="text-ink-muted-48">Reports merged</p>
          <p className="font-semibold text-ink">{incident.report_count ?? 1}</p>
        </div>
        <div>
          <p className="text-ink-muted-48">Severity</p>
          <p className="font-semibold text-ink">{incident.severity_score ?? 'Unknown'}</p>
        </div>
        <div>
          <p className="text-ink-muted-48">Barangay</p>
          <p className="font-semibold text-ink">{incident.barangay ?? 'Unknown'}</p>
        </div>
        <div>
          <p className="text-ink-muted-48">Submitted at</p>
          <p className="font-semibold text-ink">{asLocalTime(incident.created_at)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-[11px] bg-canvas-parchment p-4 text-sm text-ink-muted-80">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">AI analysis</p>
        <p className="mt-2">{incident.ai_summary || 'AI summary is still being prepared for this incident.'}</p>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted-48">All uploaded photos</p>
        {gallery.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted-48">No uploaded photos found for this incident.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {gallery.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-[11px] border border-hairline bg-canvas-parchment">
                <img src={url} alt="Incident evidence" className="h-24 w-full object-cover transition hover:scale-105" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex-1 overflow-auto border-t border-hairline pt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted-48">Comprehensive reports</p>
        {loading ? (
          <p className="mt-2 text-sm text-ink-muted-48">Loading report details...</p>
        ) : reports.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted-48">No linked reports available.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {reports.map((report) => (
              <article key={report.id} className="rounded-[11px] border border-hairline p-3">
                <div className="flex gap-3">
                  {firstImage(report) && (
                    <img src={firstImage(report)} alt="Report preview" className="h-16 w-16 shrink-0 rounded-[8px] object-cover" />
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-ink">{formatLabel(report.issue_type)}</p>
                    {report.description ? <p className="mt-1 text-ink-muted-80">{report.description}</p> : null}
                    <p className="mt-1 text-xs text-ink-muted-48">
                      {submitterLabel(report.submitter_type)}
                      {report.ai_suggested_type ? ` · AI type ${formatLabel(report.ai_suggested_type)}` : ''}
                      {typeof report.ai_confidence === 'number' ? ` · ${(report.ai_confidence * 100).toFixed(0)}% confidence` : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-ink-muted-80 sm:grid-cols-2">
                  <p>Report ID: {report.id}</p>
                  <p>Reporter: {report.reporter_user_id || 'Unknown'}</p>
                  <p>Coordinates: {asCoord(report.latitude)}, {asCoord(report.longitude)}</p>
                  <p>Submitted: {asLocalTime(report.created_at)}</p>
                  <p>Status: {report.status ? formatLabel(report.status) : 'Unknown'}</p>
                  <p>Address: {report.address_text || 'Unknown'}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
