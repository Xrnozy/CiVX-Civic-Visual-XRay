import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
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
}

interface Props {
  markers: MarkerData[];
  lguMode?: boolean;
  center?: { lat: number; lng: number };
  zoom?: number;
  selectedLocation?: { latitude: number; longitude: number } | null;
  onLocationPick?: (latitude: number, longitude: number) => void;
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

  function previewCardHtml(marker: MarkerData, expandButtonId: string): string {
    const title = escapeHtml((marker.primary_issue_type || marker.title || 'Incident').replace(/_/g, ' '));
    const submitter = marker.submitter_type === 'lgu' ? 'LGU' : 'Community member';
    const submittedAt = marker.preview_created_at || marker.created_at;
    const createdLabel = submittedAt ? escapeHtml(new Date(submittedAt).toLocaleString()) : 'Unknown';
    const aiLabel = marker.preview_ai_suggested_type
      ? `${escapeHtml(marker.preview_ai_suggested_type.replace(/_/g, ' '))}${typeof marker.preview_ai_confidence === 'number' ? ` (${Math.round(marker.preview_ai_confidence * 100)}%)` : ''}`
      : 'Pending';
    const lat = Number.isFinite(marker.latitude) ? marker.latitude.toFixed(6) : 'Unknown';
    const lng = Number.isFinite(marker.longitude) ? marker.longitude.toFixed(6) : 'Unknown';
    const image = marker.preview_photo_url
      ? `<img src="${escapeHtml(marker.preview_photo_url)}" alt="Incident preview" style="height:58px;width:58px;border-radius:10px;object-fit:cover;flex-shrink:0;" />`
      : `<div style="height:58px;width:58px;border-radius:10px;background:#f5f5f7;color:#7a7a7a;display:flex;align-items:center;justify-content:center;font-size:11px;">No photo</div>`;
    return `
      <div style="width:248px;color:#1d1d1f;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.35;">
        <div style="display:flex;gap:10px;align-items:flex-start;">
          ${image}
          <div style="min-width:0;">
            <div style="font-size:13px;font-weight:700;text-transform:capitalize;">${title}</div>
            <div style="margin-top:3px;font-size:11px;color:#7a7a7a;">${submitter} · ${createdLabel}</div>
            <div style="margin-top:6px;font-size:11px;color:#333;">AI: ${aiLabel}</div>
          </div>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#333;">${lat}, ${lng}</div>
        <button id="${expandButtonId}" style="margin-top:8px;width:100%;border:0;border-radius:999px;background:#0066cc;color:#fff;padding:7px 10px;font-size:12px;font-weight:600;cursor:pointer;">Expand details</button>
      </div>
    `;
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
  }, [apiKey, lguMode]);

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
    markerByIdRef.current.clear();
    infoWindowRef.current?.close();
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.dispose?.();
      selectedMarkerRef.current.setMap(null);
      selectedMarkerRef.current = null;
    }

    const gmarkers = markers.map((mk) => {
      const marker = new gmaps.Marker({
        position: { lat: mk.latitude, lng: mk.longitude },
        title: mk.primary_issue_type || mk.title,
        icon:
          mk.type === 'cleanup'
            ? undefined
            : {
                path: gmaps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#0066cc',
                fillOpacity: 1,
                strokeWeight: 0,
              },
      });
      marker.addListener('click', () => {
        onMarkerSelect?.(mk);
      });
      markerByIdRef.current.set(mk.id, marker);
      return marker;
    });

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

    if (gmarkers.length) {
      markerClustererRef.current = new MarkerClusterer({ markers: gmarkers, map });
    }

    return () => {
      markerClustererRef.current?.clearMarkers();
      markerClustererRef.current = null;
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

    const markerData = markers.find((item) => item.id === selectedMarkerId && item.type === 'incident');
    const marker = markerByIdRef.current.get(selectedMarkerId);
    if (!markerData || !marker) {
      infoWindowRef.current?.close();
      return;
    }

    if (!infoWindowRef.current) {
      infoWindowRef.current = new gmaps.InfoWindow();
    }
    const buttonId = `civx-expand-${markerData.id}`;
    infoWindowRef.current.setContent(previewCardHtml(markerData, buttonId));
    infoWindowRef.current.open({ map, anchor: marker });

    gmaps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
      const button = document.getElementById(buttonId);
      if (!button) return;
      button.onclick = () => onPreviewExpand?.(markerData.id);
    });
  }, [map, markers, selectedMarkerId, onPreviewExpand]);

  if (mapError) {
    const enableUrl = `https://console.cloud.google.com/apis/library/maps-backend.googleapis.com?project=${MAPS_PROJECT_ID}`;
    const dashboardUrl = `https://console.cloud.google.com/apis/dashboard?project=${MAPS_PROJECT_ID}`;
    const billingUrl = `https://console.cloud.google.com/billing/linkedaccount?project=${MAPS_PROJECT_ID}`;
    const credentialsUrl = `https://console.cloud.google.com/apis/credentials?project=${MAPS_PROJECT_ID}`;

    return (
      <div className="flex h-[70vh] w-full flex-col items-center justify-center rounded-[24px] border border-hairline bg-canvas-parchment p-8">
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
    <div className="relative h-[70vh] w-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[24px] bg-canvas-parchment text-sm text-ink-muted-48">
          Loading Google Maps…
        </div>
      )}
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}
