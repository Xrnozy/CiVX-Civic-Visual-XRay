import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MarkerClusterer, MarkerClustererEvents } from '@googlemaps/markerclusterer';
import { DEFAULT_MAP_CENTER } from '../../shared/constants';

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

function buildClusterDotIcon(count: number): any {
  const size = clusterDotSize(count);
  const fontSize = count >= 100 ? 48 : count >= 10 ? 54 : 60;
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 240 240">`
      + '<circle cx="120" cy="120" r="112" fill="#d93025" opacity="0.10"/>'
      + '<circle cx="120" cy="120" r="92" fill="#d93025" opacity="0.18"/>'
      + '<circle cx="120" cy="120" r="72" fill="#d93025" opacity="0.30"/>'
      + '<circle cx="120" cy="120" r="54" fill="#d93025" opacity="0.48"/>'
      + '<circle cx="120" cy="120" r="44" fill="#d93025" stroke="#ffffff" stroke-width="5"/>'
      + `<text x="120" y="122" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="Roboto,Arial,sans-serif" font-size="${fontSize}" font-weight="500">${count}</text>`
      + '</svg>'
  );
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new (window as any).google.maps.Size(size, size),
    anchor: new (window as any).google.maps.Point(size / 2, size / 2),
  };
}

function buildIncidentDotIcon(): any {
  const size = 36;
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 240 240">`
      + '<circle cx="120" cy="120" r="112" fill="#d93025" opacity="0.10"/>'
      + '<circle cx="120" cy="120" r="92" fill="#d93025" opacity="0.18"/>'
      + '<circle cx="120" cy="120" r="72" fill="#d93025" opacity="0.30"/>'
      + '<circle cx="120" cy="120" r="54" fill="#d93025" opacity="0.48"/>'
      + '<circle cx="120" cy="120" r="44" fill="#d93025" stroke="#ffffff" stroke-width="5"/>'
      + '</svg>'
  );
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new (window as any).google.maps.Size(size, size),
    anchor: new (window as any).google.maps.Point(size / 2, size / 2),
  };
}

function buildPinIcon(): any {
  const svg = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="56" viewBox="0 0 42 56">'
      + '<defs><filter id="s" x="-40%" y="-20%" width="180%" height="180%">'
      + '<feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.28"/></filter></defs>'
        + '<path filter="url(#s)" d="M21 2C11.06 2 3 10.06 3 20c0 12.6 13.2 26.9 16.67 30.41a2 2 0 0 0 2.86 0C25.8 46.9 39 32.6 39 20 39 10.06 30.94 2 21 2z" fill="#d93025"/>'
      + '<circle cx="21" cy="20" r="7.2" fill="#fff"/>'
      + '</svg>'
  );
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new (window as any).google.maps.Size(42, 56),
    anchor: new (window as any).google.maps.Point(21, 54),
  };
}

export function CivicMap({
  markers,
  lguMode = false,
  center = DEFAULT_MAP_CENTER,
  zoom = 13,
  selectedLocation,
  onLocationPick,
  heightClass = 'h-[70vh]',
  selectedMarkerId,
  onMarkerSelect,
  onMapBackgroundClick,
  onPreviewExpand,
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
    const subtitle = `${submitter} · ${sourceLabel}`;
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

  function cleanupPreviewCardHtml(marker: MarkerData, cardId: string): string {
    const title = escapeHtml((marker.title || 'Cleanup event').toUpperCase());
    const location = escapeHtml((marker.barangay || 'Community cleanup').toUpperCase());
    const dateBadge = escapeHtml(formatDateBadge(marker.scheduled_start || marker.created_at || marker.preview_created_at));
    const subtitle = 'Approved cleanup drive';

    return `
      <div id="${cardId}" style="width:256px;height:256px;position:relative;border-radius:18px;overflow:hidden;cursor:pointer;box-shadow:0 18px 40px rgba(0,0,0,0.28);background:linear-gradient(145deg,#0f766e 0%,#134e4a 100%);font-family:Inter,system-ui,-apple-system,sans-serif;">
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

    const loader = new Loader({ apiKey, version: 'weekly' });
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
  }, [apiKey, lguMode, center, zoom]);

  useEffect(() => {
    if (!map) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;
    if (clickListenerRef.current) {
      clickListenerRef.current.remove();
      clickListenerRef.current = null;
    }
    if (!onLocationPick && !onMapBackgroundClick) return;
    clickListenerRef.current = map.addListener('click', (event: any) => {
      onMapBackgroundClick?.();
      if (!event.latLng) return;
      onLocationPick?.(event.latLng.lat(), event.latLng.lng());
    });
    return () => {
      clickListenerRef.current?.remove();
      clickListenerRef.current = null;
    };
  }, [map, onLocationPick, onMapBackgroundClick]);

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
    infoWindowRef.current?.close();
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.dispose?.();
      selectedMarkerRef.current.setMap(null);
      selectedMarkerRef.current = null;
    }

    const validMarkers = markers.filter(isValidMarker);

    const gmarkers = validMarkers.flatMap((mk) => {
      const haloMarker = new gmaps.Marker({
        position: { lat: mk.latitude, lng: mk.longitude },
        zIndex: 1,
      });

      const pinMarker = new gmaps.Marker({
        position: { lat: mk.latitude, lng: mk.longitude },
        title: mk.primary_issue_type || mk.title,
        icon: buildIncidentDotIcon(),
        zIndex: 2,
      });
      pinMarker.addListener('click', () => {
        onMarkerSelect?.(mk);
      });
      markerByIdRef.current.set(mk.id, pinMarker);
      pulseRef.current.push({
        halo: haloMarker,
        anchor: pinMarker,
        phase: Math.random() * Math.PI * 2,
        kind: 'incident',
      });
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
          entry.halo.setIcon({
            path: gmaps.SymbolPath.CIRCLE,
            scale,
            fillColor: '#d93025',
            fillOpacity,
            strokeColor: '#d93025',
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
      if ((map.getZoom() ?? 0) < 15) {
        map.setZoom(15);
      }
    }

    let clusterEndListener: { remove: () => void } | null = null;

    if (gmarkers.length) {
      const clusterer = new MarkerClusterer({
        markers: gmarkers,
        map,
        renderer: {
          render: ({ count, position }) => new gmaps.Marker({
            position,
            icon: buildClusterDotIcon(count),
            zIndex: 1000 + count,
          }),
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
  }, [map, markers, selectedLocation, onMarkerSelect]);

  useEffect(() => {
    if (!map) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;
    if (!selectedMarkerId) {
      infoWindowRef.current?.close();
      return;
    }

    const markerData = markers.find((item) => item.id === selectedMarkerId);
    const marker = markerByIdRef.current.get(selectedMarkerId);
    if (!markerData || !marker) {
      infoWindowRef.current?.close();
      return;
    }

    if (!infoWindowRef.current) {
      infoWindowRef.current = new gmaps.InfoWindow({ headerDisabled: true });
    }
    const cardId = `civx-preview-${markerData.id}`;
    infoWindowRef.current.setContent(markerPreviewHtml(markerData, cardId));
    infoWindowRef.current.open({ map, anchor: marker });

    gmaps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
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
      card.onclick = () => onPreviewExpand?.(markerData.id);
    });
  }, [map, markers, selectedMarkerId, onPreviewExpand]);

  if (mapError) {
    const enableUrl = `https://console.cloud.google.com/apis/library/maps-backend.googleapis.com?project=${MAPS_PROJECT_ID}`;
    const dashboardUrl = `https://console.cloud.google.com/apis/dashboard?project=${MAPS_PROJECT_ID}`;
    const billingUrl = `https://console.cloud.google.com/billing/linkedaccount?project=${MAPS_PROJECT_ID}`;
    const credentialsUrl = `https://console.cloud.google.com/apis/credentials?project=${MAPS_PROJECT_ID}`;

    return (
      <div className={`flex w-full flex-col items-center justify-center rounded-[24px] border border-hairline bg-canvas-parchment p-8 ${heightClass}`}>
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
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[24px] bg-canvas-parchment text-sm text-ink-muted-48">
          Loading Google Maps…
        </div>
      )}
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}
