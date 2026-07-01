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
}

interface Props {
  markers: MarkerData[];
  lguMode?: boolean;
  center?: { lat: number; lng: number };
  zoom?: number;
}

const MAPS_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'civx-d53ad';

function keyHint(key: string): string {
  if (key.length < 12) return '(check infra/.env)';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

export function CivicMap({ markers, lguMode = false, center, zoom = 13 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';

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
        const m = new google.maps.Map(ref.current, {
          center: center ?? DEFAULT_MAP_CENTER,
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
    const gmarkers = markers.map((mk) => {
      const marker = new google.maps.Marker({
        position: { lat: mk.latitude, lng: mk.longitude },
        title: mk.primary_issue_type || mk.title,
        icon:
          mk.type === 'cleanup'
            ? undefined
            : {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#0066cc',
                fillOpacity: 1,
                strokeWeight: 0,
              },
      });
      return marker;
    });
    new MarkerClusterer({ markers: gmarkers, map });
  }, [map, markers]);

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
