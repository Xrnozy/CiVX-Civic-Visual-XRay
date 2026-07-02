import { INCIDENT_STATUSES, ISSUE_CATEGORIES } from '../../shared/constants';

export type MapLayer = 'issues' | 'events' | 'ecoquest' | 'all';

interface Props {
  mapLayer: MapLayer;
  onMapLayerChange: (layer: MapLayer) => void;
  issueType: string;
  onIssueTypeChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  incidentCount: number;
  eventCount: number;
  ecoquestCount: number;
}

const LAYERS: { id: MapLayer; label: string }[] = [
  { id: 'issues', label: 'Issues' },
  { id: 'events', label: 'Events' },
  { id: 'ecoquest', label: 'EcoQuest' },
  { id: 'all', label: 'All' },
];

function countLabel(
  mapLayer: MapLayer,
  incidentCount: number,
  eventCount: number,
  ecoquestCount: number,
) {
  if (mapLayer === 'issues') return `${incidentCount} issue${incidentCount === 1 ? '' : 's'}`;
  if (mapLayer === 'events') return `${eventCount} event${eventCount === 1 ? '' : 's'}`;
  if (mapLayer === 'ecoquest') return `${ecoquestCount} quest${ecoquestCount === 1 ? '' : 's'}`;
  return `${incidentCount} issue${incidentCount === 1 ? '' : 's'} · ${eventCount} event${eventCount === 1 ? '' : 's'} · ${ecoquestCount} quest${ecoquestCount === 1 ? '' : 's'}`;
}

export function MapFilterBar({
  mapLayer,
  onMapLayerChange,
  issueType,
  onIssueTypeChange,
  status,
  onStatusChange,
  incidentCount,
  eventCount,
  ecoquestCount,
}: Props) {
  const showIssueFilters = mapLayer === 'issues' || mapLayer === 'all';

  return (
    <div className="map-filter-bar-inner pointer-events-auto w-full">
        <div className="map-layer-toggle shadow-product" role="tablist" aria-label="Map layers">
          {LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              role="tab"
              aria-selected={mapLayer === layer.id}
              className={`map-layer-btn ${mapLayer === layer.id ? 'map-layer-btn-active' : ''}`}
              onClick={() => onMapLayerChange(layer.id)}
            >
              {layer.label}
            </button>
          ))}
        </div>

        {showIssueFilters ? (
          <>
            <select
              className="filter-select map-filter-select shadow-product"
              value={issueType}
              onChange={(e) => onIssueTypeChange(e.target.value)}
              aria-label="Filter by issue type"
            >
              <option value="">All issue types</option>
              {ISSUE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <select
              className="filter-select map-filter-select shadow-product"
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {INCIDENT_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <span className="map-filter-count shadow-product">
          {countLabel(mapLayer, incidentCount, eventCount, ecoquestCount)}
        </span>
    </div>
  );
}
