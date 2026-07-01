import { useEffect, useState } from 'react';
import { GlobalNav } from '../components/ui/GlobalNav';
import { SubNavFrosted } from '../components/ui/SubNavFrosted';
import { CivicMap } from '../components/map/CivicMap';
import { Footer } from '../components/ui/Footer';
import { ButtonPrimary } from '../components/ui/Buttons';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ISSUE_CATEGORIES, INCIDENT_STATUSES } from '../shared/constants';
import {
  CommunityIncidentDrawer,
  CommunityIncidentDetail,
  CommunityIncidentReport,
} from '../components/map/CommunityIncidentDrawer';

interface CommunityMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  primary_issue_type?: string;
  title?: string;
  type: 'incident' | 'cleanup';
  status?: string;
  severity_score?: number;
  report_count?: number;
  source?: string;
  submitter_type?: string;
  created_at?: string;
  preview_photo_url?: string;
  preview_description?: string;
  preview_ai_suggested_type?: string;
  preview_ai_confidence?: number;
  preview_created_at?: string;
  barangay?: string;
}

interface IncidentDetailsBundle {
  incident: CommunityIncidentDetail;
  reports: CommunityIncidentReport[];
}

export default function MapPage() {
  const [markers, setMarkers] = useState<CommunityMapMarker[]>([]);
  const [issueType, setIssueType] = useState('');
  const [status, setStatus] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<CommunityMapMarker | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsCache, setDetailsCache] = useState<Record<string, IncidentDetailsBundle>>({});

  useEffect(() => {
    const params = new URLSearchParams();
    if (issueType) params.set('issue_type', issueType);
    if (status) params.set('status', status);
    api<{ incidents: CommunityMapMarker[]; cleanup_events: Array<{ id: string; latitude: number; longitude: number; title: string }> }>(`/api/maps/markers?${params}`)
      .then((d) => {
        setMarkers([
          ...d.incidents.map((i) => ({ ...i, type: 'incident' as const })),
          ...d.cleanup_events.map((e) => ({ ...e, type: 'cleanup' as const })),
        ]);
      })
      .catch(() => setMarkers([]));
  }, [issueType, status]);

  useEffect(() => {
    const marker = selectedMarker;
    if (!marker || marker.type !== 'incident') return;

    let cancelled = false;
    setLoadingDetails(true);
    Promise.all([
      api<CommunityIncidentDetail>(`/api/incidents/${marker.id}`),
      api<CommunityIncidentReport[]>(`/api/incidents/${marker.id}/reports`),
    ])
      .then(([incident, reports]) => {
        if (cancelled) return;
        setDetailsCache((prev) => ({
          ...prev,
          [marker.id]: { incident, reports },
        }));
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMarker?.id]);

  const activeDetails = selectedMarker && selectedMarker.type === 'incident' ? detailsCache[selectedMarker.id] : undefined;
  const drawerIncident = activeDetails?.incident ?? null;
  const drawerReports = activeDetails?.reports ?? [];

  function closePreview() {
    setSelectedMarker(null);
    setExpanded(false);
  }

  return (
    <div className="min-h-screen bg-canvas">
      <GlobalNav />
      <SubNavFrosted
        title="Community Map"
        lead="Public issues and approved cleanup events near you"
        action={<Link to="/report"><ButtonPrimary>Report Issue</ButtonPrimary></Link>}
      />
      <div className="page-content">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <select className="filter-select" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
            <option value="">All issue types</option>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <span className="text-sm text-ink-muted-48">{markers.length} markers</span>
        </div>
        <div className="map-shell relative">
          <div className="min-h-[70vh]">
            <CivicMap
              markers={markers}
              selectedMarkerId={selectedMarker?.type === 'incident' ? selectedMarker.id : null}
              onMarkerSelect={(marker) => {
                if (marker.type !== 'incident') {
                  setSelectedMarker(null);
                  setExpanded(false);
                  return;
                }
                setSelectedMarker(marker);
              }}
              onMapBackgroundClick={closePreview}
              onPreviewExpand={(markerId) => {
                const marker = markers.find((item) => item.id === markerId && item.type === 'incident');
                if (marker) {
                  setSelectedMarker(marker);
                  setExpanded(true);
                }
              }}
            />
          </div>
          {expanded && selectedMarker?.type === 'incident' ? (
            <>
              <button
                type="button"
                aria-label="Close incident details"
                className="absolute inset-0 z-20 bg-black/40"
                onClick={() => setExpanded(false)}
              />
              <div className="absolute inset-y-0 left-0 z-30 flex h-full w-full max-w-[min(100%,420px)] sm:w-[min(42%,480px)] sm:min-w-[320px]">
                <CommunityIncidentDrawer
                  incident={drawerIncident}
                  reports={drawerReports}
                  loading={loadingDetails}
                  onClose={() => setExpanded(false)}
                  overlay
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
      <Footer />
    </div>
  );
}
