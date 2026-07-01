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
    if (detailsCache[marker.id]) return;

    setLoadingDetails(true);
    Promise.all([
      api<CommunityIncidentDetail>(`/api/incidents/${marker.id}`),
      api<CommunityIncidentReport[]>(`/api/incidents/${marker.id}/reports`),
    ])
      .then(([incident, reports]) => {
        setDetailsCache((prev) => ({
          ...prev,
          [marker.id]: { incident, reports },
        }));
      })
      .finally(() => setLoadingDetails(false));
  }, [selectedMarker, detailsCache]);

  const activeDetails = selectedMarker && selectedMarker.type === 'incident' ? detailsCache[selectedMarker.id] : undefined;
  const fallbackIncident: CommunityIncidentDetail | null =
    selectedMarker && selectedMarker.type === 'incident'
      ? {
          id: selectedMarker.id,
          primary_issue_type: selectedMarker.primary_issue_type || 'incident',
          status: selectedMarker.status || 'verified',
          severity_score: selectedMarker.severity_score,
          report_count: selectedMarker.report_count,
          latitude: selectedMarker.latitude,
          longitude: selectedMarker.longitude,
          source: selectedMarker.source,
          submitter_type: selectedMarker.submitter_type,
          created_at: selectedMarker.created_at,
        }
      : null;

  const drawerIncident = activeDetails?.incident || fallbackIncident;
  const drawerReports = activeDetails?.reports || [];

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
        <div className="map-shell">
          <div className={`grid gap-0 ${expanded && drawerIncident ? 'lg:grid-cols-[minmax(280px,1fr)_3fr]' : 'grid-cols-1'}`}>
            {expanded && drawerIncident ? (
              <div className="border-b border-hairline bg-canvas p-3 lg:min-h-[70vh] lg:border-b-0 lg:border-r">
                <CommunityIncidentDrawer
                  incident={drawerIncident}
                  reports={drawerReports}
                  loading={loadingDetails}
                  onClose={() => setExpanded(false)}
                />
              </div>
            ) : null}
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
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
