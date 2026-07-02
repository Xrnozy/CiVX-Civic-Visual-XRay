import { MapFilterBar, type MapLayer } from './MapFilterBar';
import { MapSubNav, type MapSubNavConfig } from './MapSubNav';
import { MapTopAction } from './MapTopAction';

interface Props {
  subNav?: MapSubNavConfig;
  mapLayer: MapLayer;
  onMapLayerChange: (layer: MapLayer) => void;
  issueType: string;
  onIssueTypeChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  incidentCount: number;
  eventCount: number;
}

export function MapTopBar({
  subNav,
  mapLayer,
  onMapLayerChange,
  issueType,
  onIssueTypeChange,
  status,
  onStatusChange,
  incidentCount,
  eventCount,
}: Props) {
  return (
    <div className="map-controls-overlay">
      <div className="map-top-bar pointer-events-auto">
        <div className="map-top-bar-title">
          <MapSubNav title={subNav?.title} lead={subNav?.lead} />
        </div>

        <div className="map-top-bar-filters">
          <MapFilterBar
            mapLayer={mapLayer}
            onMapLayerChange={onMapLayerChange}
            issueType={issueType}
            onIssueTypeChange={onIssueTypeChange}
            status={status}
            onStatusChange={onStatusChange}
            incidentCount={incidentCount}
            eventCount={eventCount}
          />
        </div>

        <div className="map-top-bar-action">
          <MapTopAction actionTo={subNav?.actionTo} actionLabel={subNav?.actionLabel} />
        </div>
      </div>
    </div>
  );
}
