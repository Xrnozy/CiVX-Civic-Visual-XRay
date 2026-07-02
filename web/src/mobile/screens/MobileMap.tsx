import { useEffect, useMemo, useState } from 'react';
import { ISSUE_CATEGORIES } from '../../shared/constants';

interface Marker {
  id: string;
  latitude: number;
  longitude: number;
  primary_issue_type?: string;
  title?: string;
  barangay?: string;
  status?: string;
  scheduled_start?: string;
  type: 'incident' | 'cleanup';
}

type Layer = 'issues' | 'events' | 'both';

function titleFor(marker: Marker) {
  return marker.type === 'cleanup'
    ? marker.title || 'Cleanup event'
    : marker.primary_issue_type?.replace(/_/g, ' ') || 'Civic report';
}

function subtitleFor(marker: Marker) {
  return marker.type === 'cleanup'
    ? `${marker.barangay || 'Community area'} - Approved cleanup drive`
    : `${marker.barangay || 'Nearby'} - Issue report`;
}

export default function MobileMap() {
  const [incidents, setIncidents] = useState<Marker[]>([]);
  const [events, setEvents] = useState<Marker[]>([]);
  const [layer, setLayer] = useState<Layer>('issues');
  const [issueType, setIssueType] = useState('');
  const [selected, setSelected] = useState<Marker | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (issueType) params.set('issue_type', issueType);
    fetch(`/api/maps/markers?${params}`)
      .then((r) => r.json())
      .then((d) => {
        const nextIncidents = (d.incidents || []).map((i: Marker) => ({ ...i, type: 'incident' as const }));
        const nextEvents = (d.cleanup_events || []).map((e: Marker) => ({ ...e, type: 'cleanup' as const }));
        setIncidents(nextIncidents);
        setEvents(nextEvents);
        setSelected((current) => current && [...nextIncidents, ...nextEvents].some((m) => m.id === current.id) ? current : null);
      })
      .catch(() => {
        setIncidents([]);
        setEvents([]);
        setSelected(null);
      });
  }, [issueType]);

  const markers = useMemo(() => {
    if (layer === 'issues') return incidents;
    if (layer === 'events') return events;
    return [...incidents, ...events];
  }, [layer, incidents, events]);

  const visibleMarkers = markers.slice(0, 8);
  const selectedMarker = selected && visibleMarkers.some((m) => m.id === selected.id) ? selected : visibleMarkers[0] || null;

  return (
    <div className="mobile-map-experience">
      <section className="mobile-map-header-panel">
        <p className="mobile-native-eyebrow">Community Map</p>
        <h1>Nearby civic activity</h1>
        <div>
          <span>{incidents.length} issues</span>
          <span>{events.length} cleanups</span>
        </div>
      </section>

      <div className="mobile-map-filters">
        <div className="mobile-native-segment">
          {(['issues', 'events', 'both'] as const).map((l) => (
            <button key={l} type="button" className={layer === l ? 'active' : ''} onClick={() => { setLayer(l); setSelected(null); }}>
              {l === 'issues' ? 'Issues' : l === 'events' ? 'Events' : 'Both'}
            </button>
          ))}
        </div>
        {layer !== 'events' && (
          <select value={issueType} onChange={(e) => { setIssueType(e.target.value); setSelected(null); }}>
            <option value="">All types</option>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        )}
      </div>

      <section className="mobile-map-canvas" aria-label="Interactive demo community map">
        <div className="mobile-map-land" />
        <div className="mobile-map-road mobile-map-road-a" />
        <div className="mobile-map-road mobile-map-road-b" />
        <div className="mobile-map-road mobile-map-road-c" />
        <div className="mobile-map-water" />

        {visibleMarkers.map((marker, index) => {
          const isSelected = selectedMarker?.id === marker.id;
          return (
            <button
              key={marker.id}
              type="button"
              aria-label={titleFor(marker)}
              className={`mobile-map-pin ${marker.type === 'cleanup' ? 'cleanup' : ''} ${isSelected ? 'selected' : ''}`}
              style={{ left: `${16 + ((index * 19) % 68)}%`, top: `${28 + ((index * 23) % 44)}%` }}
              onClick={() => setSelected(marker)}
            />
          );
        })}

        {visibleMarkers.length === 0 ? (
          <div className="mobile-native-map-empty">
            <strong>Community map</strong>
            <span>Live map data appears here when reports or events are available.</span>
          </div>
        ) : null}
      </section>

      <section className="mobile-map-preview-sheet">
        {selectedMarker ? (
          <>
            <article className={`mobile-map-preview-card ${selectedMarker.type === 'cleanup' ? 'cleanup' : ''}`}>
              <span>{selectedMarker.type === 'cleanup' ? 'Cleanup' : 'Issue'}</span>
              <h2>{titleFor(selectedMarker)}</h2>
              <p>{subtitleFor(selectedMarker)}</p>
            </article>
            <div className="mobile-map-nearby-list">
              <h3>Nearby activity</h3>
              {visibleMarkers.map((marker) => (
                <button key={marker.id} type="button" className={selectedMarker.id === marker.id ? 'active' : ''} onClick={() => setSelected(marker)}>
                  <strong>{titleFor(marker)}</strong>
                  <span>{marker.type === 'cleanup' ? 'Cleanup event' : 'Issue report'}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mobile-map-empty-sheet">
            <h2>No map items yet</h2>
            <p>Try submitting a demo report, then return here to see it listed.</p>
          </div>
        )}
      </section>
    </div>
  );
}
