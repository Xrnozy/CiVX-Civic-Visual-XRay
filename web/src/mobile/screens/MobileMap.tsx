import { useEffect, useMemo, useState } from 'react';
import { CivicMap } from '../../components/map/CivicMap';
import { ISSUE_CATEGORIES } from '../../shared/constants';

interface Marker {
  id: string;
  latitude: number;
  longitude: number;
  primary_issue_type?: string;
  title?: string;
  type: 'incident' | 'cleanup';
}

type Layer = 'issues' | 'events' | 'both';

export default function MobileMap() {
  const [incidents, setIncidents] = useState<Marker[]>([]);
  const [events, setEvents] = useState<Marker[]>([]);
  const [layer, setLayer] = useState<Layer>('issues');
  const [issueType, setIssueType] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (issueType) params.set('issue_type', issueType);
    fetch(`/api/maps/markers?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setIncidents((d.incidents || []).map((i: Marker) => ({ ...i, type: 'incident' as const })));
        setEvents((d.cleanup_events || []).map((e: Marker) => ({ ...e, type: 'cleanup' as const })));
      })
      .catch(() => {
        setIncidents([]);
        setEvents([]);
      });
  }, [issueType]);

  const markers = useMemo(() => {
    if (layer === 'issues') return incidents;
    if (layer === 'events') return events;
    return [...incidents, ...events];
  }, [layer, incidents, events]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-2 border-b border-hairline bg-white p-3">
        {(['issues', 'events', 'both'] as const).map((l) => (
          <button
            key={l}
            type="button"
            className={`map-layer-btn ${layer === l ? 'map-layer-btn-active' : ''}`}
            onClick={() => setLayer(l)}
          >
            {l === 'issues' ? 'Issues' : l === 'events' ? 'Events' : 'Both'}
          </button>
        ))}
        {layer !== 'events' && (
          <select className="filter-select text-xs" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
            <option value="">All types</option>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <CivicMap markers={markers} zoom={13} heightClass="h-full" hideMapChrome flush />
      </div>
    </div>
  );
}
