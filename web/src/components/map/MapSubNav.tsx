interface Props {
  title?: string;
  lead?: string;
}

export interface MapSubNavConfig {
  title?: string;
  lead?: string;
  actionTo?: string;
  actionLabel?: string;
}

export function MapSubNav({
  title = 'Community Map',
  lead = 'Public issues and approved cleanup events near you',
}: Props) {
  return (
    <div className="map-title-text-block">
      <h1 className="map-sub-nav-title">{title}</h1>
      <p className="map-sub-nav-lead">{lead}</p>
    </div>
  );
}
