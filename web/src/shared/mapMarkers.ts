/** Map marker colors and icons — shared between mobile badges and web SVG markers. */

import {
  mdiAlertRhombusOutline,
  mdiDeleteCircle,
  mdiDumpTruck,
  mdiCalendarStar,
  mdiLightbulbOn,
  mdiMapMarkerAlert,
  mdiPipeLeak,
  mdiRoad,
  mdiRoadVariant,
  mdiShieldAlert,
  mdiSignCaution,
  mdiSignDirection,
  mdiSpeedometerMedium,
  mdiTrashCan,
  mdiTrashCanOutline,
  mdiTree,
  mdiWalk,
  mdiWater,
  mdiWaterOutline,
  mdiWaves,
  mdiCircleOutline,
  mdiLeaf,
} from '@mdi/js';

export type MapMarkerType = 'incident' | 'cleanup' | 'ecoquest';

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
  ecoquest_task: '#15803d',
};

/** MaterialCommunityIcons names for mobile custom markers. */
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
  ecoquest_task: 'leaf',
};

/** MDI SVG paths keyed by issue slug (matches mobile icon semantics). */
const ISSUE_MARKER_MDI_PATHS: Record<string, string> = {
  garbage_pile: mdiTrashCan,
  scattered_trash: mdiTrashCanOutline,
  overflowing_trash_bin: mdiDeleteCircle,
  illegal_dumping: mdiDumpTruck,
  pothole: mdiAlertRhombusOutline,
  broken_road: mdiRoad,
  road_crack: mdiRoadVariant,
  uneven_road: mdiSpeedometerMedium,
  flooding: mdiWaves,
  dirty_canal: mdiWater,
  dirty_river: mdiWaterOutline,
  clogged_drainage: mdiPipeLeak,
  broken_sidewalk: mdiWalk,
  broken_streetlight: mdiLightbulbOn,
  open_manhole: mdiCircleOutline,
  fallen_tree: mdiTree,
  road_obstruction: mdiSignCaution,
  damaged_traffic_sign: mdiSignDirection,
  unsafe_public_area: mdiShieldAlert,
  cleanup_event: mdiCalendarStar,
  ecoquest_task: mdiLeaf,
};

export const CLEANUP_MARKER_COLOR = '#0f766e';
export const ECOQUEST_MARKER_COLOR = '#15803d';
export const DEFAULT_INCIDENT_MARKER_COLOR = '#d93025';

export const ISSUE_BADGE_SIZE = 38;
export const ISSUE_DOT_SIZE = 12;

export interface GoogleMapsMarkerIcon {
  url: string;
  scaledSize: { width: number; height: number };
  anchor: { x: number; y: number };
}

export function markerColorForIssue(
  issueType?: string,
  markerType: MapMarkerType = 'incident',
): string {
  if (markerType === 'cleanup') return CLEANUP_MARKER_COLOR;
  if (markerType === 'ecoquest') return ECOQUEST_MARKER_COLOR;
  if (!issueType) return DEFAULT_INCIDENT_MARKER_COLOR;
  return ISSUE_MARKER_COLORS[issueType] ?? DEFAULT_INCIDENT_MARKER_COLOR;
}

export function issueMarkerIconName(
  issueType?: string,
  markerType: MapMarkerType = 'incident',
): string {
  if (markerType === 'cleanup') return ISSUE_MARKER_ICONS.cleanup_event;
  if (markerType === 'ecoquest') return ISSUE_MARKER_ICONS.ecoquest_task;
  if (!issueType) return 'map-marker-alert';
  return ISSUE_MARKER_ICONS[issueType] ?? 'map-marker-alert';
}

export function hasCustomIssueMarker(
  issueType?: string,
  markerType: MapMarkerType = 'incident',
): boolean {
  if (markerType === 'cleanup' || markerType === 'ecoquest') return true;
  return Boolean(issueType && issueType in ISSUE_MARKER_ICONS);
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function issueBadgeSvg(color: string, pathD: string, size = ISSUE_BADGE_SIZE, count?: number): string {
  const iconSize = Math.round(size * 0.52);
  const offset = (size - iconSize) / 2;
  const countOverlay =
    count && count > 1
      ? `<circle cx="${size - 6}" cy="6" r="9" fill="#ffffff" stroke="${color}" stroke-width="2"/>
         <text x="${size - 6}" y="7" text-anchor="middle" dominant-baseline="central" fill="${color}" font-family="Roboto,Arial,sans-serif" font-size="9" font-weight="700">${count > 9 ? '9+' : count}</text>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><filter id="s"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.2"/></filter></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="#ffffff" stroke-width="2" filter="url(#s)"/>
    <g transform="translate(${offset},${offset}) scale(${iconSize / 24})" fill="#ffffff">
      <path d="${pathD}"/>
    </g>
    ${countOverlay}
  </svg>`;
}

function issueDotSvg(color: string, size = ISSUE_DOT_SIZE): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1.5}" fill="${color}" stroke="#ffffff" stroke-width="2"/>
  </svg>`;
}

export function buildGoogleMapsIssueIcon(
  issueType?: string,
  markerType: MapMarkerType = 'incident',
  mergedCount = 1,
): GoogleMapsMarkerIcon {
  const color = markerColorForIssue(issueType, markerType);

  if (!hasCustomIssueMarker(issueType, markerType)) {
    const size = ISSUE_DOT_SIZE;
    return {
      url: svgDataUrl(issueBadgeSvg(color, mdiMapMarkerAlert, size + 8, mergedCount)),
      scaledSize: { width: size + 8, height: size + 8 },
      anchor: { x: (size + 8) / 2, y: (size + 8) / 2 },
    };
  }

  const key =
    markerType === 'cleanup'
      ? 'cleanup_event'
      : markerType === 'ecoquest'
        ? 'ecoquest_task'
        : issueType!;
  const pathD = ISSUE_MARKER_MDI_PATHS[key] ?? mdiTrashCan;
  const size = ISSUE_BADGE_SIZE;

  return {
    url: svgDataUrl(issueBadgeSvg(color, pathD, size, mergedCount)),
    scaledSize: { width: size, height: size },
    anchor: { x: size / 2, y: size / 2 },
  };
}
