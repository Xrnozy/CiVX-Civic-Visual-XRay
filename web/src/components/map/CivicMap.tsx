import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MarkerClusterer, MarkerClustererEvents } from '@googlemaps/markerclusterer';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_PIN_ZOOM, DEFAULT_MAP_ZOOM } from '../../shared/constants';
import { mergeMapMarkersByProximity, MAP_MARKER_MERGE_RADIUS_M } from '../../shared/mergeMapMarkers';
import { buildGoogleMapsIssueIcon, CLEANUP_MARKER_COLOR } from '../../shared/mapMarkers';

interface MarkerData {
  id: string;
  latitude: number;
  longitude: number;
  primary_issue_type?: string;
  title?: string;
  type: 'incident' | 'cleanup';
  status?: string;
  severity_score?: number;
  report_count?: number;
  source?: string;
  submitter_type?: string;
  created_at?: string;
  preview_photo_url?: string;
  preview_description?: string;
  preview_ai_suggested_type?: string;
  preview_ai_confidence?: number;
  preview_created_at?: string;
  barangay?: string;
  scheduled_start?: string;
  merged_count?: number;
  merged_ids?: string[];
}

interface Props {
  markers: MarkerData[];
  lguMode?: boolean;
  center?: { lat: number; lng: number };
  zoom?: number;
  selectedLocation?: { latitude: number; longitude: number } | null;
  onLocationPick?: (latitude: number, longitude: number) => void;
  heightClass?: string;
  selectedMarkerId?: string | null;
  onMarkerSelect?: (marker: MarkerData) => void;
  onMapBackgroundClick?: () => void;
  onPreviewExpand?: (markerId: string) => void;
  /** Hide map/satellite toggle and fullscreen control (e.g. community map page). */
  hideMapChrome?: boolean;
  /** Edge-to-edge map (no rounded corners on map surface). */
  flush?: boolean;
  /** Merge markers within this many meters (real-world). Default 1 m; set 0 to disable. */
  mergeProximityMeters?: number;
}

const MAPS_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'civx-d53ad';

function keyHint(key: string): string {
  if (key.length < 12) return '(check infra/.env)';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

function clusterDotSize(count: number): number {
  if (count >= 100) return 68;
  if (count >= 10) return 60;
  return 52;
}

function isValidMarker(mk: MarkerData): boolean {
  if (mk.latitude == null || mk.longitude == null) return false;
  if (Number.isNaN(mk.latitude) || Number.isNaN(mk.longitude)) return false;
  if (mk.type === 'incident') return Boolean(mk.primary_issue_type);
  return Boolean(mk.title);
}

function buildClusterDotIcon(count: number, color = '#d93025'): any {
  const size = clusterDotSize(count);
  const fontSize = count >= 100 ? 48 : count >= 10 ? 54 : 60;
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 240 240">`
      + `<circle cx="120" cy="120" r="112" fill="${color}" opacity="0.10"/>`
      + `<circle cx="120" cy="120" r="92" fill="${color}" opacity="0.18"/>`
      + `<circle cx="120" cy="120" r="72" fill="${color}" opacity="0.30"/>`
      + `<circle cx="120" cy="120" r="54" fill="${color}" opacity="0.48"/>`
      + `<circle cx="120" cy="120" r="44" fill="${color}" stroke="#ffffff" stroke-width="5"/>`
      + `<text x="120" y="122" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="Roboto,Arial,sans-serif" font-size="${fontSize}" font-weight="500">${count}</text>`
      + '</svg>'
  );
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new (window as any).google.maps.Size(size, size),
    anchor: new (window as any).google.maps.Point(size / 2, size / 2),
  };
}

function buildPinIcon(): any {
  const iconSpec = buildGoogleMapsIssueIcon(undefined, 'incident');
  const gmaps = (window as any).google?.maps;
  return {
    url: iconSpec.url,
    scaledSize: new gmaps.Size(iconSpec.scaledSize.width, iconSpec.scaledSize.height),
    anchor: new gmaps.Point(iconSpec.anchor.x, iconSpec.anchor.y),
  };
}

function toGoogleMapsIcon(
  issueType?: string,
  markerType: 'incident' | 'cleanup' = 'incident',
  mergedCount = 1,
): any {
  const iconSpec = buildGoogleMapsIssueIcon(issueType, markerType, mergedCount);
  const gmaps = (window as any).google?.maps;
  return {
    url: iconSpec.url,
    scaledSize: new gmaps.Size(iconSpec.scaledSize.width, iconSpec.scaledSize.height),
    anchor: new gmaps.Point(iconSpec.anchor.x, iconSpec.anchor.y),
  };
}

export function CivicMap({
  markers,
  lguMode = false,
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  selectedLocation,
  onLocationPick,
  heightClass = 'h-[70vh]',
  selectedMarkerId,
  onMarkerSelect,
  onMapBackgroundClick,
  onPreviewExpand,
  hideMapChrome = false,
  flush = false,
  mergeProximityMeters = MAP_MARKER_MERGE_RADIUS_M,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';
  const markerClustererRef = useRef<MarkerClusterer | null>(null);
  const markerByIdRef = useRef<Map<string, any>>(new Map());
  const pulseRef = useRef<Array<{ halo: any; anchor: any; phase: number; kind: 'incident' | 'cluster' }>>([]);
  const pulseTimerRef = useRef<number | null>(null);
  const infoWindowRef = useRef<any>(null);
  const selectedMarkerRef = useRef<any>(null);
  const clickListenerRef = useRef<any>(null);
  const onMarkerSelectRef = useRef(onMarkerSelect);
  const onMapBackgroundClickRef = useRef(onMapBackgroundClick);
  const onPreviewExpandRef = useRef(onPreviewExpand);
  const onLocationPickRef = useRef(onLocationPick);
  const suppressMapClickRef = useRef(false);
  const openInfoMarkerIdRef = useRef<string | null>(null);

  useEffect(() => {
    onMarkerSelectRef.current = onMarkerSelect;
  }, [onMarkerSelect]);

  useEffect(() => {
    onMapBackgroundClickRef.current = onMapBackgroundClick;
  }, [onMapBackgroundClick]);

  useEffect(() => {
    onPreviewExpandRef.current = onPreviewExpand;
  }, [onPreviewExpand]);

  useEffect(() => {
    onLocationPickRef.current = onLocationPick;
  }, [onLocationPick]);

  const displayMarkers = useMemo(() => {
    const valid = markers.filter(isValidMarker);
    if (!mergeProximityMeters || mergeProximityMeters <= 0) {
      return valid.map((m) => ({ ...m, merged_count: 1, merged_ids: [m.id] }));
    }
    return mergeMapMarkersByProximity(valid, mergeProximityMeters) as MarkerData[];
  }, [markers, mergeProximityMeters]);

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function previewCardHtml(marker: MarkerData, cardId: string): string {
    const title = escapeHtml((marker.primary_issue_type || marker.title || 'Incident').replace(/_/g, ' ').toUpperCase());
    const location = escapeHtml((marker.barangay || 'Unknown location').toUpperCase());
    const submitter = marker.submitter_type === 'lgu' ? 'LGU' : 'Community member';
    const sourceLabel = escapeHtml(
      (marker.source || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    );
    const submittedAt = marker.preview_created_at || marker.created_at;
    const dateBadge = escapeHtml(formatDateBadge(submittedAt));
    const subtitle = marker.merged_count && marker.merged_count > 1
      ? `${submitter} · ${sourceLabel} · ${marker.merged_count} within 1 m`
      : `${submitter} · ${sourceLabel}`;
    const photoUrl = marker.preview_photo_url ? escapeHtml(marker.preview_photo_url) : '';
    const bgStyle = photoUrl
      ? `background-image:url('${photoUrl}');background-size:cover;background-position:center;`
      : 'background:linear-gradient(145deg,#667085 0%,#344054 100%);';

    return `
      <div id="${cardId}" style="width:256px;height:256px;position:relative;border-radius:18px;overflow:hidden;cursor:pointer;box-shadow:0 18px 40px rgba(0,0,0,0.28);${bgStyle}font-family:Inter,system-ui,-apple-system,sans-serif;">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.38) 0%,rgba(0,0,0,0.08) 38%,rgba(0,0,0,0.08) 52%,rgba(0,0,0,0.78) 100%);"></div>
        <div style="position:absolute;top:16px;left:16px;right:16px;font-size:10px;font-weight:600;letter-spacing:0.08em;line-height:1.35;color:rgba(255,255,255,0.95);text-shadow:0 1px 4px rgba(0,0,0,0.55);">${location}</div>
        <div style="position:absolute;bottom:16px;left:16px;right:16px;display:flex;align-items:flex-end;justify-content:space-between;gap:10px;">
          <div style="min-width:0;padding-right:4px;">
            <div style="font-size:22px;font-weight:800;line-height:1.05;letter-spacing:0.01em;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,0.5);">${title}</div>
            <div style="margin-top:8px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.94);text-shadow:0 1px 4px rgba(0,0,0,0.45);">${subtitle}</div>
          </div>
          <div style="flex-shrink:0;border-radius:999px;background:rgba(0,0,0,0.62);backdrop-filter:blur(4px);padding:6px 11px;font-size:10px;font-weight:700;letter-spacing:0.05em;color:#fff;">${dateBadge}</div>
        </div>
      </div>
    `;
  }

  function formatDateBadge(iso?: string): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    return `${month} ${date.getDate()}`;
  }

  /** Ensure readable zoom when a marker is selected (no pan — fit handles positioning). */
  function ensureMarkerZoom(): boolean {
    if (!map) return false;
    const zoom = map.getZoom();
    const needsZoom = typeof zoom === 'number' && zoom < DEFAULT_MAP_PIN_ZOOM;
    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'post-fix',location:'CivicMap.tsx:ensureMarkerZoom',message:'ensureMarkerZoom called',data:{currentZoom:zoom,needsZoom},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (needsZoom) {
      map.setZoom(DEFAULT_MAP_PIN_ZOOM);
    }
    return needsZoom;
  }

  /** Center the marker + preview card together inside the map viewport. */
  function fitPreviewStackInView(gmaps: any, markerData: MarkerData, cardId: string, pass: 'single') {
    if (!map) return;
    const mapEl = map.getDiv() as HTMLElement | undefined;
    const card = document.getElementById(cardId);
    if (!mapEl || !card) {
      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'post-fix',location:'CivicMap.tsx:fitPreviewStackInView',message:'fit skipped - missing elements',data:{pass,cardId,hasMapEl:!!mapEl,hasCard:!!card},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return;
    }

    const latLng = new gmaps.LatLng(markerData.latitude, markerData.longitude);
    const overlay = new gmaps.OverlayView();
    overlay.onAdd = () => {};
    overlay.draw = () => {
      const projection = overlay.getProjection();
      if (!projection) return;

      const mapRect = mapEl.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const markerPx = projection.fromLatLngToContainerPixel(latLng);
      if (!markerPx) return;

      const markerPad = 24;
      const relX = (client: number) => client - mapRect.left;
      const relY = (client: number) => client - mapRect.top;

      const minX = Math.min(relX(cardRect.left), markerPx.x - markerPad);
      const maxX = Math.max(relX(cardRect.right), markerPx.x + markerPad);
      const minY = Math.min(relY(cardRect.top), markerPx.y - markerPad);
      const maxY = Math.max(relY(cardRect.bottom), markerPx.y + markerPad);

      const topInset = -200;
      const edgePad = 20;
      const targetCenterX = mapRect.width / 2;
      const targetCenterY = topInset + (mapRect.height - topInset - edgePad) / 2;

      const stackCenterX = (minX + maxX) / 2;
      const stackCenterY = (minY + maxY) / 2;

      const panX = stackCenterX - targetCenterX;
      const panY = stackCenterY - targetCenterY;
      const willPan = Math.abs(panX) > 4 || Math.abs(panY) > 4;

      // #region agent log
      fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'post-fix',location:'CivicMap.tsx:fitPreviewStackInView',message:'fit calculation',data:{pass,markerId:markerData.id,mapW:mapRect.width,mapH:mapRect.height,cardL:relX(cardRect.left),cardR:relX(cardRect.right),markerPxX:markerPx.x,markerPxY:markerPx.y,stackCenterX,stackCenterY,targetCenterX,targetCenterY,panX,panY,willPan},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      overlay.setMap(null);

      if (willPan) {
        map.panBy(panX, panY);
      }
    };
    overlay.setMap(map);
  }

  /** One fit pass after InfoWindow layout is stable — avoids stacked pan animations. */
  function runAfterPreviewLayout(gmaps: any, markerData: MarkerData, cardId: string) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        fitPreviewStackInView(gmaps, markerData, cardId, 'single');
      });
    });
  }

  function cleanupPreviewCardHtml(marker: MarkerData, cardId: string): string {
    const title = escapeHtml((marker.title || 'Cleanup event').toUpperCase());
    const location = escapeHtml((marker.barangay || 'Community cleanup').toUpperCase());
    const dateBadge = escapeHtml(formatDateBadge(marker.scheduled_start || marker.created_at || marker.preview_created_at));
    const subtitle = marker.merged_count && marker.merged_count > 1
      ? `Approved cleanup drive · ${marker.merged_count} within 1 m`
      : 'Approved cleanup drive';

    const photoUrl = marker.preview_photo_url ? escapeHtml(marker.preview_photo_url) : '';
    const bgStyle = photoUrl
      ? `background-image:url('${photoUrl}');background-size:cover;background-position:center;`
      : 'background:linear-gradient(145deg,#0f766e 0%,#134e4a 100%);';

    return `
      <div id="${cardId}" style="width:256px;height:256px;position:relative;border-radius:18px;overflow:hidden;cursor:pointer;box-shadow:0 18px 40px rgba(0,0,0,0.28);${bgStyle}font-family:Inter,system-ui,-apple-system,sans-serif;">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.38) 0%,rgba(0,0,0,0.08) 38%,rgba(0,0,0,0.08) 52%,rgba(0,0,0,0.78) 100%);"></div>
        <div style="position:absolute;top:16px;left:16px;right:16px;font-size:10px;font-weight:600;letter-spacing:0.08em;line-height:1.35;color:rgba(255,255,255,0.95);text-shadow:0 1px 4px rgba(0,0,0,0.55);">${location}</div>
        <div style="position:absolute;bottom:16px;left:16px;right:16px;display:flex;align-items:flex-end;justify-content:space-between;gap:10px;">
          <div style="min-width:0;padding-right:4px;">
            <div style="font-size:22px;font-weight:800;line-height:1.05;letter-spacing:0.01em;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,0.5);">${title}</div>
            <div style="margin-top:8px;font-size:11px;font-weight:500;color:rgba(255,255,255,0.94);text-shadow:0 1px 4px rgba(0,0,0,0.45);">${subtitle}</div>
          </div>
          <div style="flex-shrink:0;border-radius:999px;background:rgba(0,0,0,0.62);backdrop-filter:blur(4px);padding:6px 11px;font-size:10px;font-weight:700;letter-spacing:0.05em;color:#fff;">${dateBadge}</div>
        </div>
      </div>
    `;
  }

  function markerPreviewHtml(marker: MarkerData, cardId: string): string {
    if (marker.type === 'cleanup') {
      return cleanupPreviewCardHtml(marker, cardId);
    }
    return previewCardHtml(marker, cardId);
  }

  useEffect(() => {
    if (!apiKey) {
      setMapError('missing_key');
      setLoading(false);
      return;
    }
    if (!ref.current) return;

    let cancelled = false;
    setMapError(null);
    setLoading(true);

    (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
      if (!cancelled) {
        setMapError('not_activated');
        setLoading(false);
      }
    };

    const loader = new Loader({ apiKey, version: '3.58' });
    loader
      .load()
      .then(() => {
        if (cancelled || !ref.current) return;
        const gmaps = (window as any).google?.maps;
        if (!gmaps) {
          setMapError('load_failed');
          setLoading(false);
          return;
        }
        const m = new gmaps.Map(ref.current, {
          center,
          zoom,
          styles: lguMode ? undefined : [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
          disableDefaultUI: false,
          mapTypeControl: hideMapChrome ? false : true,
          fullscreenControl: hideMapChrome ? false : true,
        });
        setMap(m);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setMapError('load_failed');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      delete (window as Window & { gm_authFailure?: () => void }).gm_authFailure;
    };
  }, [apiKey, lguMode, center, zoom, hideMapChrome]);

  useEffect(() => {
    if (!map || selectedLocation) return;
    map.setCenter(center);
    map.setZoom(zoom);
  }, [map, center, zoom, selectedLocation]);

  useEffect(() => {
    if (!map) return;
    if (clickListenerRef.current) {
      clickListenerRef.current.remove();
      clickListenerRef.current = null;
    }
    clickListenerRef.current = map.addListener('click', (event: any) => {
      if (suppressMapClickRef.current) return;
      if (onMapBackgroundClickRef.current) {
        onMapBackgroundClickRef.current();
        return;
      }
      if (onLocationPickRef.current && event?.latLng) {
        onLocationPickRef.current(event.latLng.lat(), event.latLng.lng());
      }
    });
    return () => {
      clickListenerRef.current?.remove();
      clickListenerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;
    if (markerClustererRef.current) {
      markerClustererRef.current.clearMarkers();
      markerClustererRef.current = null;
    }
    if (pulseTimerRef.current) {
      window.clearInterval(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    pulseRef.current.forEach(({ halo, anchor }) => {
      halo.setMap(null);
      anchor.setMap(null);
    });
    pulseRef.current = [];
    markerByIdRef.current.clear();
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.dispose?.();
      selectedMarkerRef.current.setMap(null);
      selectedMarkerRef.current = null;
    }

    const validMarkers = displayMarkers;

    const gmarkers = validMarkers.flatMap((mk) => {
      const pinMarker = new gmaps.Marker({
        position: { lat: mk.latitude, lng: mk.longitude },
        title: mk.primary_issue_type || mk.title,
        icon: toGoogleMapsIcon(mk.primary_issue_type, mk.type, mk.merged_count ?? 1),
        zIndex: mk.type === 'cleanup' ? 3 : 2,
      });
      (pinMarker as { __civxMarkerType?: string }).__civxMarkerType = mk.type;
      pinMarker.addListener('click', (event: any) => {
        suppressMapClickRef.current = true;
        window.setTimeout(() => {
          suppressMapClickRef.current = false;
        }, 120);
        event?.domEvent?.stopPropagation?.();
        onMarkerSelectRef.current?.(mk);
      });
      markerByIdRef.current.set(mk.id, pinMarker);
      return [pinMarker];
    });

    function startPulseLoop() {
      if (pulseTimerRef.current) return;
      pulseTimerRef.current = window.setInterval(() => {
        pulseRef.current.forEach((entry) => {
          const anchorMap = entry.anchor.getMap();
          if (!anchorMap || !entry.anchor.getVisible()) {
            entry.halo.setMap(null);
            return;
          }
          const position = entry.anchor.getPosition();
          if (position) {
            entry.halo.setPosition(position);
          }
          entry.halo.setMap(anchorMap);
          entry.phase += 0.14;
          const baseScale = entry.kind === 'cluster' ? 34 : 12;
          const scale = baseScale + (Math.sin(entry.phase) + 1) * 4;
          const fillOpacity = 0.12 + (Math.sin(entry.phase) + 1) * 0.08;
          const strokeOpacity = 0.2 + (Math.sin(entry.phase) + 1) * 0.12;
          const clusterColor = entry.kind === 'cluster' && (entry.anchor as { __civxClusterTeal?: boolean }).__civxClusterTeal
            ? CLEANUP_MARKER_COLOR
            : '#d93025';
          entry.halo.setIcon({
            path: gmaps.SymbolPath.CIRCLE,
            scale,
            fillColor: clusterColor,
            fillOpacity,
            strokeColor: clusterColor,
            strokeOpacity,
            strokeWeight: 1,
          });
        });
      }, 70);
    }

    function syncClusterPulses() {
      const clusterer = markerClustererRef.current as { clusters?: Array<{ markers: unknown[]; marker?: unknown }> } | null;
      if (!clusterer?.clusters) return;

      const activeAnchors = new Set<unknown>();
      clusterer.clusters.forEach((cluster) => {
        if (cluster.markers.length > 1 && cluster.marker) {
          activeAnchors.add(cluster.marker);
        }
      });

      pulseRef.current = pulseRef.current.filter((entry) => {
        if (entry.kind !== 'cluster') return true;
        if (activeAnchors.has(entry.anchor)) return true;
        entry.halo.setMap(null);
        return false;
      });

      clusterer.clusters.forEach((cluster) => {
        if (cluster.markers.length <= 1 || !cluster.marker) return;
        const anchor = cluster.marker as { getPosition: () => unknown; getZIndex?: () => number };
        const alreadyTracked = pulseRef.current.some(
          (entry) => entry.kind === 'cluster' && entry.anchor === cluster.marker,
        );
        if (alreadyTracked) return;

        const haloMarker = new gmaps.Marker({
          position: anchor.getPosition(),
          zIndex: Number(anchor.getZIndex?.() ?? 1000) - 1,
        });
        pulseRef.current.push({
          halo: haloMarker,
          anchor: cluster.marker,
          phase: Math.random() * Math.PI * 2,
          kind: 'cluster',
        });
      });

      startPulseLoop();
    }

    if (pulseRef.current.length) {
      startPulseLoop();
    }

    if (selectedLocation) {
      const haloMarker = new gmaps.Marker({
        position: {
          lat: selectedLocation.latitude,
          lng: selectedLocation.longitude,
        },
        title: 'Pinned location',
        zIndex: 2,
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#d93025',
          fillOpacity: 0.22,
          strokeColor: '#d93025',
          strokeOpacity: 0.42,
          strokeWeight: 1,
        },
      });
      haloMarker.setMap(map);

      let pulsePhase = 0;
      const pulseTimer = window.setInterval(() => {
        pulsePhase += 0.14;
        const scale = 12 + (Math.sin(pulsePhase) + 1) * 4;
        const fillOpacity = 0.12 + (Math.sin(pulsePhase) + 1) * 0.08;
        const strokeOpacity = 0.2 + (Math.sin(pulsePhase) + 1) * 0.12;
        haloMarker.setIcon({
          path: gmaps.SymbolPath.CIRCLE,
          scale,
          fillColor: '#d93025',
          fillOpacity,
          strokeColor: '#d93025',
          strokeOpacity,
          strokeWeight: 1,
        });
      }, 70);

      const selectedMarker = new gmaps.Marker({
        position: {
          lat: selectedLocation.latitude,
          lng: selectedLocation.longitude,
        },
        title: 'Pinned location',
        icon: buildPinIcon(),
        zIndex: 3,
      });
      selectedMarker.setMap(map);
      selectedMarkerRef.current = {
        primary: selectedMarker,
        halo: haloMarker,
        pulseTimer,
        dispose() {
          window.clearInterval(this.pulseTimer);
        },
        setMap(nextMap: any) {
          this.primary.setMap(nextMap);
          this.halo.setMap(nextMap);
        },
      };
      map.panTo({ lat: selectedLocation.latitude, lng: selectedLocation.longitude });
      map.setZoom(DEFAULT_MAP_PIN_ZOOM);
    }

    let clusterEndListener: { remove: () => void } | null = null;

    if (gmarkers.length) {
      const clusterer = new MarkerClusterer({
        markers: gmarkers,
        map,
        renderer: {
          render: ({ count, position, markers: clusterMarkers }) => {
            const allCleanup = (clusterMarkers as Array<{ __civxMarkerType?: string }>).every(
              (m) => m.__civxMarkerType === 'cleanup',
            );
            const clusterColor = allCleanup ? CLEANUP_MARKER_COLOR : '#d93025';
            const clusterMarker = new gmaps.Marker({
              position,
              icon: buildClusterDotIcon(count, clusterColor),
              zIndex: 1000 + count,
            });
            (clusterMarker as { __civxClusterTeal?: boolean }).__civxClusterTeal = allCleanup;
            return clusterMarker;
          },
        },
      });
      markerClustererRef.current = clusterer;
      clusterEndListener = gmaps.event.addListener(
        clusterer,
        MarkerClustererEvents.CLUSTERING_END,
        syncClusterPulses,
      );
      syncClusterPulses();
    }

    return () => {
      clusterEndListener?.remove();
      markerClustererRef.current?.clearMarkers();
      markerClustererRef.current = null;
      if (pulseTimerRef.current) {
        window.clearInterval(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
      pulseRef.current.forEach(({ halo, anchor }) => {
        halo.setMap(null);
        anchor.setMap(null);
      });
      pulseRef.current = [];
      selectedMarkerRef.current?.dispose?.();
      selectedMarkerRef.current?.setMap(null);
      selectedMarkerRef.current = null;
    };
  }, [map, displayMarkers, selectedLocation]);

  useEffect(() => {
    if (!map) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;
    if (!selectedMarkerId) {
      infoWindowRef.current?.close();
      openInfoMarkerIdRef.current = null;
      return;
    }

    const markerData = displayMarkers.find(
      (item) =>
        item.id === selectedMarkerId ||
        (item.merged_ids?.includes(selectedMarkerId) ?? false),
    );
    const marker = markerData ? markerByIdRef.current.get(markerData.id) : undefined;
    if (!markerData || !marker) {
      infoWindowRef.current?.close();
      openInfoMarkerIdRef.current = null;
      return;
    }

    const markerKey = markerData.id;
    const cardId = `civx-preview-${markerKey}`;
    const contentHtml = markerPreviewHtml(markerData, cardId);

    if (!infoWindowRef.current) {
      infoWindowRef.current = new gmaps.InfoWindow({
        headerDisabled: true,
        disableAutoPan: true,
        pixelOffset: new gmaps.Size(0, 0),
      });
    } else {
      infoWindowRef.current.setOptions({
        disableAutoPan: true,
        pixelOffset: new gmaps.Size(0, 0),
      });
    }

    const sameMarker = openInfoMarkerIdRef.current === markerKey;
    // #region agent log
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',runId:'post-fix',location:'CivicMap.tsx:selectedMarkerEffect',message:'selectedMarker effect run',data:{selectedMarkerId,sameMarker,markerKey,displayMarkersCount:displayMarkers.length,infoWindowOpen:!!infoWindowRef.current?.getMap?.()},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    if (sameMarker && infoWindowRef.current?.getMap?.()) {
      return;
    }

    openInfoMarkerIdRef.current = markerKey;

    const bindPreviewCard = () => {
      const iwRoot = document.querySelector('.gm-style-iw') as HTMLElement | null;
      const iwOuter = document.querySelector('.gm-style-iw-c') as HTMLElement | null;
      const iwInner = document.querySelector('.gm-style-iw-d') as HTMLElement | null;
      const iwHeader = document.querySelector('.gm-style-iw-ch') as HTMLElement | null;
      if (iwRoot) {
        iwRoot.style.padding = '0';
        iwRoot.style.maxWidth = 'none';
      }
      if (iwHeader) {
        iwHeader.style.display = 'none';
      }
      if (iwOuter) {
        iwOuter.style.padding = '0';
        iwOuter.style.borderRadius = '18px';
        iwOuter.style.overflow = 'hidden';
        iwOuter.style.boxShadow = 'none';
        iwOuter.style.background = 'transparent';
      }
      if (iwInner) {
        iwInner.style.overflow = 'hidden';
        iwInner.style.maxHeight = 'none';
        iwInner.style.padding = '0';
      }
      document.querySelectorAll('.gm-ui-hover-effect').forEach((node) => {
        (node as HTMLElement).style.display = 'none';
      });
      const card = document.getElementById(cardId);
      if (!card) return;
      card.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        suppressMapClickRef.current = true;
        window.setTimeout(() => {
          suppressMapClickRef.current = false;
        }, 200);
        onPreviewExpandRef.current?.(markerKey);
      };
      runAfterPreviewLayout(gmaps, markerData, cardId);
    };

    const openPreview = () => {
      infoWindowRef.current.setContent(contentHtml);
      infoWindowRef.current.open({ map, anchor: marker, shouldFocus: false });
      gmaps.event.addListenerOnce(infoWindowRef.current, 'domready', bindPreviewCard);
    };

    const zoomAnimating = ensureMarkerZoom();
    if (zoomAnimating) {
      gmaps.event.addListenerOnce(map, 'idle', openPreview);
    } else {
      openPreview();
    }
  }, [map, displayMarkers, selectedMarkerId]);

  if (mapError) {
    const enableUrl = `https://console.cloud.google.com/apis/library/maps-backend.googleapis.com?project=${MAPS_PROJECT_ID}`;
    const dashboardUrl = `https://console.cloud.google.com/apis/dashboard?project=${MAPS_PROJECT_ID}`;
    const billingUrl = `https://console.cloud.google.com/billing/linkedaccount?project=${MAPS_PROJECT_ID}`;
    const credentialsUrl = `https://console.cloud.google.com/apis/credentials?project=${MAPS_PROJECT_ID}`;
    const shellRadius = flush ? '' : 'rounded-[24px]';

    return (
      <div className={`flex w-full flex-col items-center justify-center border border-hairline bg-canvas-parchment p-8 ${shellRadius} ${heightClass}`}>
        <p className="text-lg font-semibold text-ink">Google Maps setup required</p>
        <p className="mt-2 max-w-xl text-center text-sm text-ink-muted-80">
          {mapError === 'not_activated' && (
            <>
              <strong>ApiNotActivatedMapError</strong> — your key referrers look fine, but the{' '}
              <strong>Maps JavaScript API is not enabled</strong> on project{' '}
              <code className="text-primary">{MAPS_PROJECT_ID}</code> yet.
            </>
          )}
          {mapError === 'missing_key' && 'Set VITE_GOOGLE_MAPS_API_KEY in infra/.env'}
          {mapError === 'load_failed' && 'Google Maps failed to load. Check the browser console for details.'}
        </p>

        <p className="mt-4 text-xs text-ink-muted-48">
          Key in use: <code className="text-primary">{keyHint(apiKey)}</code> — must match the key you edited in
          Credentials.
        </p>

        <ol className="mt-6 max-w-xl space-y-3 text-left text-sm text-ink-muted-80">
          <li>
            <strong>1. Enable the API</strong> (this is separate from key restrictions):{' '}
            <a className="text-primary underline" href={enableUrl} target="_blank" rel="noreferrer">
              Open Maps JavaScript API → Enable
            </a>
          </li>
          <li>
            <strong>2. Confirm it shows “Enabled”</strong> on the{' '}
            <a className="text-primary underline" href={dashboardUrl} target="_blank" rel="noreferrer">
              Enabled APIs dashboard
            </a>
            . If not listed, step 1 was not completed.
          </li>
          <li>
            <strong>3. Link billing</strong> (required even for free tier):{' '}
            <a className="text-primary underline" href={billingUrl} target="_blank" rel="noreferrer">
              Billing for {MAPS_PROJECT_ID}
            </a>
          </li>
          <li>
            <strong>4. Match the API key</strong> — in{' '}
            <a className="text-primary underline" href={credentialsUrl} target="_blank" rel="noreferrer">
              Credentials
            </a>
            , copy the Browser key into <code>infra/.env</code> as{' '}
            <code>VITE_GOOGLE_MAPS_API_KEY</code>. Referrers you already set (
            <code>http://localhost:5173/*</code>) are correct.
          </li>
          <li>
            <strong>5. Wait 5 minutes</strong>, restart <code>npm run dev</code>, hard-refresh the page.
          </li>
        </ol>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${heightClass}`}>
      {loading && (
        <div className={`absolute inset-0 z-10 flex items-center justify-center bg-canvas-parchment text-sm text-ink-muted-48 ${flush ? '' : 'rounded-[24px]'}`}>
          Loading Google Maps…
        </div>
      )}
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}
