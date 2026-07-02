/** Merge map markers that fall within a real-world radius (meters). */

export const MAP_MARKER_MERGE_RADIUS_M = 1;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface MapMarkerLike {
  id: string;
  latitude: number;
  longitude: number;
  type: 'incident' | 'cleanup' | 'ecoquest';
  primary_issue_type?: string;
  severity_score?: number;
  report_count?: number;
}

export type MergedMapMarker<T extends MapMarkerLike> = T & {
  merged_count: number;
  merged_ids: string[];
};

function shouldGroup(a: MapMarkerLike, b: MapMarkerLike): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'incident' && b.type === 'incident') {
    const typeA = a.primary_issue_type;
    const typeB = b.primary_issue_type;
    if (typeA && typeB && typeA !== typeB) return false;
  }
  return true;
}

function pickRepresentative<T extends MapMarkerLike>(group: T[]): T {
  return [...group].sort((a, b) => {
    const sev = (b.severity_score ?? 0) - (a.severity_score ?? 0);
    if (sev !== 0) return sev;
    const reports = (b.report_count ?? 0) - (a.report_count ?? 0);
    if (reports !== 0) return reports;
    return a.id.localeCompare(b.id);
  })[0];
}

/**
 * Group markers within `radiusM` meters (default 1 m). Same layer only:
 * incidents with incidents (same issue type), events with events.
 */
export function mergeMapMarkersByProximity<T extends MapMarkerLike>(
  markers: T[],
  radiusM = MAP_MARKER_MERGE_RADIUS_M,
): MergedMapMarker<T>[] {
  if (markers.length <= 1) {
    return markers.map((m) => ({ ...m, merged_count: 1, merged_ids: [m.id] }));
  }

  const parent = markers.map((_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  function union(i: number, j: number) {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[rj] = ri;
  }

  for (let i = 0; i < markers.length; i++) {
    for (let j = i + 1; j < markers.length; j++) {
      const a = markers[i];
      const b = markers[j];
      if (!shouldGroup(a, b)) continue;
      const dist = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
      if (dist <= radiusM) union(i, j);
    }
  }

  const groups = new Map<number, T[]>();
  markers.forEach((marker, index) => {
    const root = find(index);
    const list = groups.get(root) ?? [];
    list.push(marker);
    groups.set(root, list);
  });

  return Array.from(groups.values()).map((group) => {
    const rep = pickRepresentative(group);
    const merged_ids = group.map((m) => m.id);
    const lat = group.reduce((sum, m) => sum + m.latitude, 0) / group.length;
    const lng = group.reduce((sum, m) => sum + m.longitude, 0) / group.length;
    return {
      ...rep,
      id: rep.id,
      latitude: lat,
      longitude: lng,
      merged_count: group.length,
      merged_ids,
    };
  });
}
