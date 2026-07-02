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
  source?: string;
  latitude?: number;
  longitude?: number;
  address_text?: string;
  submitter_type?: string;
}

interface Props {
  incident: CommunityIncidentDetail | null;
  reports: CommunityIncidentReport[];
  loading: boolean;
  onClose: () => void;
  overlay?: boolean;
  onOpenGallery?: (images: string[], index: number) => void;
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

function formatSourceLabel(source?: string): string {
  if (!source) return 'Unknown';
  return formatLabel(source);
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

export function CommunityIncidentDrawer({ incident, reports, loading, onClose, overlay = false, onOpenGallery }: Props) {
  const gallery = allImages(reports);

  function openGallery(url: string) {
    const index = gallery.indexOf(url);
    if (index >= 0) onOpenGallery?.(gallery, index);
  }

  if (loading && !incident) {
    return (
      <aside
        className={
          overlay
            ? 'flex h-full w-full flex-col items-center justify-center rounded-[20px] border border-hairline bg-canvas shadow-2xl'
            : 'flex min-h-[320px] flex-col items-center justify-center rounded-[20px] border border-hairline bg-canvas'
        }
      >
        <p className="text-sm text-ink-muted-48">Loading incident details…</p>
      </aside>
    );
  }

  if (!incident) return null;

  const incidentSource = formatSourceLabel(incident.source);
  const incidentStatus = formatLabel(incident.status);

  return (
    <aside
      className={
        overlay
          ? 'flex h-full w-full flex-col overflow-hidden rounded-[20px] border border-hairline bg-canvas shadow-2xl'
          : 'flex max-h-[min(85vh,720px)] flex-col overflow-hidden rounded-[20px] border border-hairline bg-canvas'
      }
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 pb-4 pt-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Incident details</p>
          <h2 className="mt-1 text-[21px] font-semibold capitalize text-ink">{formatLabel(incident.primary_issue_type)}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <IncidentStatusBadge status={incident.status} />
            <span className="inline-flex rounded-full bg-canvas-parchment px-3 py-1 text-xs capitalize text-ink-muted-80">
              {incidentSource}
            </span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-sm text-ink-muted-48 hover:bg-canvas-parchment hover:text-ink">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
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
            <p className="text-ink-muted-48">Status</p>
            <p className="font-semibold capitalize text-ink">{incidentStatus}</p>
          </div>
          <div>
            <p className="text-ink-muted-48">Source</p>
            <p className="font-semibold capitalize text-ink">{incidentSource}</p>
          </div>
          <div>
            <p className="text-ink-muted-48">Submitted at</p>
            <p className="font-semibold text-ink">{asLocalTime(incident.created_at)}</p>
          </div>
          {incident.verified_at ? (
            <div>
              <p className="text-ink-muted-48">Verified at</p>
              <p className="font-semibold text-ink">{asLocalTime(incident.verified_at)}</p>
            </div>
          ) : null}
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
            <div className="mt-3 rounded-[11px] border border-hairline bg-canvas-parchment px-4 py-3">
              <div className="flex flex-wrap gap-3 pl-1">
                {gallery.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => openGallery(url)}
                    className="my-1 ml-2 shrink-0 overflow-hidden rounded-[11px] border border-hairline bg-canvas text-left"
                  >
                    <img
                      src={url}
                      alt="Incident evidence"
                      className="h-24 w-24 object-contain p-1 transition hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-hairline pt-4">
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
                      <button
                        type="button"
                        onClick={() => openGallery(firstImage(report)!)}
                        className="shrink-0 overflow-hidden rounded-[8px]"
                      >
                        <img src={firstImage(report)} alt="Report preview" className="h-16 w-16 object-cover transition hover:scale-105" />
                      </button>
                    )}
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold capitalize text-ink">{formatLabel(report.issue_type)}</p>
                      {report.description ? <p className="mt-1 text-ink-muted-80">{report.description}</p> : null}
                      <p className="mt-1 text-xs capitalize text-ink-muted-48">
                        {submitterLabel(report.submitter_type)}
                        {incident.source ? ` · ${incidentSource}` : ''}
                        {` · ${incidentStatus}`}
                        {report.ai_suggested_type ? ` · AI type ${formatLabel(report.ai_suggested_type)}` : ''}
                        {typeof report.ai_confidence === 'number' ? ` · ${(report.ai_confidence * 100).toFixed(0)}% confidence` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-ink-muted-80 sm:grid-cols-2">
                    <p>Report ID: {report.id}</p>
                    <p className="capitalize">Source: {incidentSource}</p>
                    <p>Coordinates: {asCoord(report.latitude)}, {asCoord(report.longitude)}</p>
                    <p>Submitted: {asLocalTime(report.created_at)}</p>
                    <p className="capitalize">Status: {incidentStatus}</p>
                    <p>Barangay: {report.address_text || 'Unknown'}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
