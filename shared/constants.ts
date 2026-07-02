export const ISSUE_CATEGORIES = [
  'garbage_pile',
  'scattered_trash',
  'overflowing_trash_bin',
  'illegal_dumping',
  'pothole',
  'broken_road',
  'road_crack',
  'uneven_road',
  'flooding',
  'dirty_canal',
  'dirty_river',
  'clogged_drainage',
  'broken_sidewalk',
  'broken_streetlight',
  'open_manhole',
  'fallen_tree',
  'road_obstruction',
  'damaged_traffic_sign',
  'unsafe_public_area',
  'cleanup_event',
] as const;

export const INCIDENT_STATUSES = [
  'detected',
  'pending_review',
  'verified',
  'assigned',
  'ongoing',
  'resolved',
  'archived',
] as const;

/** Geographic center of Metro Manila (NCR) — Rizal Park / Manila city center */
export const DEFAULT_MAP_CENTER = { lat: 14.5995, lng: 120.9842 };
export const DEFAULT_MAP_ZOOM = 11;
export const DEFAULT_MAP_PIN_ZOOM = 13;

export function formatDefaultMapCoordinates() {
  return {
    latitude: DEFAULT_MAP_CENTER.lat.toFixed(6),
    longitude: DEFAULT_MAP_CENTER.lng.toFixed(6),
  };
}

export const ECOQUEST_TASK_TYPES = [
  'clean_sidewalk',
  'collect_trash',
  'clean_canal',
  'plant_trees',
  'remove_posters',
  'report_illegal_dumping',
  'assist_cleanup_drive',
] as const;

export const ECOQUEST_STATUSES = [
  'open',
  'in_progress',
  'pending_review',
  'approved',
  'rejected',
  'closed',
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type EcoQuestTaskType = (typeof ECOQUEST_TASK_TYPES)[number];
export type EcoQuestStatus = (typeof ECOQUEST_STATUSES)[number];
