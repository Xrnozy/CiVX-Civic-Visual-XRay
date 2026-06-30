import { useEffect, useState } from 'react';
import { GlobalNav } from '../components/ui/GlobalNav';
import { SubNavFrosted } from '../components/ui/SubNavFrosted';
import { CivicMap } from '../components/map/CivicMap';
import { Footer } from '../components/ui/Footer';
import { ButtonPrimary } from '../components/ui/Buttons';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ISSUE_CATEGORIES, INCIDENT_STATUSES } from '../shared/constants';

export default function MapPage() {
  const [markers, setMarkers] = useState<Array<{ id: string; latitude: number; longitude: number; primary_issue_type?: string; title?: string; type: 'incident' | 'cleanup' }>>([]);
  const [issueType, setIssueType] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (issueType) params.set('issue_type', issueType);
    if (status) params.set('status', status);
    api<{ incidents: Array<{ id: string; latitude: number; longitude: number; primary_issue_type: string }>; cleanup_events: Array<{ id: string; latitude: number; longitude: number; title: string }> }>(`/api/maps/markers?${params}`)
      .then((d) => {
        setMarkers([
          ...d.incidents.map((i) => ({ ...i, type: 'incident' as const })),
          ...d.cleanup_events.map((e) => ({ ...e, type: 'cleanup' as const })),
        ]);
      })
      .catch(() => setMarkers([]));
  }, [issueType, status]);

  return (
    <div className="min-h-screen bg-canvas">
      <GlobalNav />
      <SubNavFrosted
        title="Community Map"
        lead="Public issues and approved cleanup events near you"
        action={<Link to="/login"><ButtonPrimary>Report Issue</ButtonPrimary></Link>}
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
          <CivicMap markers={markers} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
