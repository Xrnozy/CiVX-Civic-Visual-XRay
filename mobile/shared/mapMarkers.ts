/** Map marker colors and icons — shared between mobile badges and web SVG markers. */

export const ISSUE_MARKER_COLORS: Record<string, string> = {
  garbage_pile: '#d93025',
  scattered_trash: '#d93025',
  overflowing_trash_bin: '#c5221f',
  illegal_dumping: '#c5221f',
  pothole: '#e37400',
  broken_road: '#e37400',
  road_crack: '#e37400',
  uneven_road: '#e37400',
  flooding: '#0066cc',
  dirty_canal: '#1a73e8',
  dirty_river: '#1a73e8',
  clogged_drainage: '#0066cc',
  broken_sidewalk: '#7c3aed',
  broken_streetlight: '#7c3aed',
  open_manhole: '#c5221f',
  fallen_tree: '#188038',
  road_obstruction: '#e37400',
  damaged_traffic_sign: '#7c3aed',
  unsafe_public_area: '#c5221f',
  cleanup_event: '#0f766e',
};

export const ISSUE_MARKER_ICONS: Record<string, string> = {
  garbage_pile: 'trash-can',
  scattered_trash: 'trash-can-outline',
  overflowing_trash_bin: 'delete-circle',
  illegal_dumping: 'dump-truck',
  pothole: 'alert-rhombus-outline',
  broken_road: 'road',
  road_crack: 'road-variant',
  uneven_road: 'speed-bump',
  flooding: 'waves',
  dirty_canal: 'water',
  dirty_river: 'water-outline',
  clogged_drainage: 'pipe-leak',
  broken_sidewalk: 'walk',
  broken_streetlight: 'lightbulb-on',
  open_manhole: 'manhole',
  fallen_tree: 'tree',
  road_obstruction: 'sign-caution',
  damaged_traffic_sign: 'sign-direction',
  unsafe_public_area: 'shield-alert',
  cleanup_event: 'calendar-star',
};

export const CLEANUP_MARKER_COLOR = '#0f766e';
export const DEFAULT_INCIDENT_MARKER_COLOR = '#d93025';

export function markerColorForIssue(
  issueType?: string,
  markerType: 'incident' | 'cleanup' = 'incident',
): string {
  if (markerType === 'cleanup') return CLEANUP_MARKER_COLOR;
  if (!issueType) return DEFAULT_INCIDENT_MARKER_COLOR;
  return ISSUE_MARKER_COLORS[issueType] ?? DEFAULT_INCIDENT_MARKER_COLOR;
}

export function issueMarkerIconName(
  issueType?: string,
  markerType: 'incident' | 'cleanup' = 'incident',
): string {
  if (markerType === 'cleanup') return ISSUE_MARKER_ICONS.cleanup_event;
  if (!issueType) return 'map-marker-alert';
  return ISSUE_MARKER_ICONS[issueType] ?? 'map-marker-alert';
}

export function hasCustomIssueMarker(
  issueType?: string,
  markerType: 'incident' | 'cleanup' = 'incident',
): boolean {
  if (markerType === 'cleanup') return true;
  return Boolean(issueType && issueType in ISSUE_MARKER_ICONS);
}
