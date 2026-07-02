import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { colors, productShadow, radii, type } from '../styles/theme';
import ProfileAvatarButton from './ProfileAvatarButton';

type MarkerType = 'incident' | 'cleanup';

type CommunityMapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  primary_issue_type?: string;
  title?: string;
  type: MarkerType;
  status?: string;
  source?: string;
  submitter_type?: string;
  barangay?: string;
};

type MapMarkersResponse = {
  incidents: Array<Omit<CommunityMapMarker, 'type'> & { primary_issue_type: string }>;
  cleanup_events?: Array<Omit<CommunityMapMarker, 'type'> & { title: string }>;
};

type GoogleMapsStatus = 'idle' | 'loading' | 'ready' | 'missing_key' | 'not_activated' | 'load_failed';

const CENTER = { lat: 14.5995, lng: 120.9842 };
const GOOGLE_MAPS_SCRIPT_ID = 'civx-google-maps-js';
const GOOGLE_MAPS_PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'civx-d53ad';

let googleMapsPromise: Promise<void> | null = null;

function formatLabel(value?: string) {
  return value?.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || 'Unknown';
}

function markerTitle(marker: CommunityMapMarker) {
  return marker.type === 'cleanup' ? marker.title || 'Cleanup event' : formatLabel(marker.primary_issue_type);
}

function markerSubtitle(marker: CommunityMapMarker) {
  if (marker.type === 'cleanup') return `${marker.barangay || 'Community cleanup'} - Approved cleanup drive`;
  const submitter = marker.submitter_type === 'lgu' ? 'LGU' : 'Community member';
  return `${submitter} - ${formatLabel(marker.source || 'unknown')}`;
}

function hasCoordinates(marker: CommunityMapMarker) {
  return typeof marker.latitude === 'number'
    && typeof marker.longitude === 'number'
    && !Number.isNaN(marker.latitude)
    && !Number.isNaN(marker.longitude);
}

function keyHint(key: string) {
  if (key.length < 12) return '(check mobile/.env)';
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

function loadGoogleMaps(apiKey: string) {
  const w = window as Window & {
    google?: any;
    gm_authFailure?: () => void;
  };

  if (w.google?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=3.58`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load.'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function buildPinIcon(gmaps: any, type: MarkerType, selected: boolean) {
  const fill = type === 'cleanup' ? '#0f766e' : '#d93025';
  const size = selected ? 42 : 34;
  const inner = selected ? 15 : 12;
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
      + `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${fill}" fill-opacity="0.18"/>`
      + `<circle cx="${size / 2}" cy="${size / 2}" r="${inner + 5}" fill="#ffffff"/>`
      + `<circle cx="${size / 2}" cy="${size / 2}" r="${inner}" fill="${fill}" stroke="${selected ? '#1d1d1f' : '#ffffff'}" stroke-width="3"/>`
      + '</svg>',
  );

  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new gmaps.Size(size, size),
    anchor: new gmaps.Point(size / 2, size / 2),
  };
}

function GoogleMapDiv({ mapRef }: { mapRef: (node: HTMLDivElement | null) => void }) {
  return (
    <div
      ref={mapRef}
      style={{
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      }}
    />
  );
}

export default function CommunityMapScreen({ showProfile = false }: { showProfile?: boolean }) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const googleMarkerRefs = useRef<any[]>([]);
  const [markers, setMarkers] = useState<CommunityMapMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<CommunityMapMarker | null>(null);
  const [mapsStatus, setMapsStatus] = useState<GoogleMapsStatus>('idle');
  const [markersLoading, setMarkersLoading] = useState(true);
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';

  useEffect(() => {
    let cancelled = false;
    setMarkersLoading(true);
    api<MapMarkersResponse>('/api/maps/markers')
      .then((data) => {
        if (cancelled) return;
        const nextMarkers = [
          ...data.incidents.map((incident) => ({ ...incident, type: 'incident' as const })),
          ...(data.cleanup_events ?? []).map((event) => ({ ...event, type: 'cleanup' as const })),
        ].filter(hasCoordinates);
        setMarkers(nextMarkers);
        setSelectedMarker(nextMarkers[0] || null);
      })
      .catch(() => {
        if (!cancelled) setMarkers([]);
      })
      .finally(() => {
        if (!cancelled) setMarkersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const w = window as Window & {
      google?: any;
      gm_authFailure?: () => void;
    };

    if (!apiKey) {
      setMapsStatus('missing_key');
      return;
    }
    if (!mapElementRef.current) return;

    setMapsStatus('loading');
    w.gm_authFailure = () => {
      if (!cancelled) setMapsStatus('not_activated');
    };

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapElementRef.current) return;
        const gmaps = w.google?.maps;
        if (!gmaps) {
          setMapsStatus('load_failed');
          return;
        }
        mapRef.current = new gmaps.Map(mapElementRef.current, {
          center: CENTER,
          zoom: 13,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit.line', stylers: [{ visibility: 'off' }] },
          ],
        });
        setMapsStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setMapsStatus('load_failed');
      });

    return () => {
      cancelled = true;
      delete w.gm_authFailure;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const gmaps = (window as any).google?.maps;
    if (!map || !gmaps || mapsStatus !== 'ready') return;

    googleMarkerRefs.current.forEach((marker) => marker.setMap(null));
    googleMarkerRefs.current = [];

    const bounds = new gmaps.LatLngBounds();
    markers.forEach((marker) => {
      const position = { lat: marker.latitude, lng: marker.longitude };
      bounds.extend(position);
      const googleMarker = new gmaps.Marker({
        map,
        position,
        title: markerTitle(marker),
        icon: buildPinIcon(gmaps, marker.type, selectedMarker?.id === marker.id && selectedMarker.type === marker.type),
        zIndex: selectedMarker?.id === marker.id ? 10 : marker.type === 'cleanup' ? 3 : 2,
      });
      googleMarker.addListener('click', () => setSelectedMarker(marker));
      googleMarkerRefs.current.push(googleMarker);
    });

    if (markers.length === 1) {
      map.setCenter({ lat: markers[0].latitude, lng: markers[0].longitude });
      map.setZoom(15);
    } else if (markers.length > 1) {
      map.fitBounds(bounds, 64);
    }

    return () => {
      googleMarkerRefs.current.forEach((marker) => marker.setMap(null));
      googleMarkerRefs.current = [];
    };
  }, [markers, selectedMarker, mapsStatus]);

  const counts = useMemo(() => ({
    incidents: markers.filter((marker) => marker.type === 'incident').length,
    cleanups: markers.filter((marker) => marker.type === 'cleanup').length,
  }), [markers]);

  const visibleMarkers = markers.slice(0, 8);

  function focusMarker(marker: CommunityMapMarker) {
    setSelectedMarker(marker);
    const map = mapRef.current;
    if (!map) return;
    map.panTo({ lat: marker.latitude, lng: marker.longitude });
    if (map.getZoom() < 15) map.setZoom(15);
  }

  const showMapError = mapsStatus === 'missing_key' || mapsStatus === 'not_activated' || mapsStatus === 'load_failed';

  return (
    <View style={styles.screen}>
      {showProfile && <ProfileAvatarButton />}
      <View style={styles.mapCanvas}>
        {showMapError ? (
          <View style={styles.setupPanel}>
            <Text style={styles.setupTitle}>Google Maps setup required</Text>
            <Text style={styles.setupBody}>
              {mapsStatus === 'missing_key'
                ? 'Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in mobile/.env.'
                : mapsStatus === 'not_activated'
                  ? `Google rejected this browser key for project ${GOOGLE_MAPS_PROJECT_ID}. Check Maps JavaScript API, billing, and allowed referrers.`
                  : 'Google Maps failed to load. Check the key, billing, and referrers.'}
            </Text>
            <Text style={styles.setupHint}>Key in use: {keyHint(apiKey)}</Text>
            <Text style={styles.setupSteps}>
              Enable Maps JavaScript API, link billing, then allow http://localhost:8082/* and http://192.168.254.115:8082/* in the browser key referrers.
            </Text>
          </View>
        ) : (
          <GoogleMapDiv mapRef={(node) => {
            mapElementRef.current = node;
          }}
          />
        )}
        {mapsStatus === 'loading' ? (
          <View style={styles.loadingPill}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading Google Maps</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.headerPanel}>
        <Text style={styles.eyebrow}>Community Map</Text>
        <Text style={styles.headerTitle}>Nearby civic activity</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}><View style={styles.incidentLegendDot} /><Text style={styles.legendText}>{counts.incidents} issues</Text></View>
          <View style={styles.legendItem}><View style={styles.cleanupLegendDot} /><Text style={styles.legendText}>{counts.cleanups} cleanups</Text></View>
        </View>
      </View>

      {markersLoading ? (
        <View style={[styles.loadingPill, styles.markerLoadingPill]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading markers</Text>
        </View>
      ) : null}

      <View style={styles.sheet}>
        {selectedMarker ? (
          <View style={[styles.previewCard, selectedMarker.type === 'cleanup' && styles.cleanupPreviewCard]}>
            <Text style={styles.previewKind}>{selectedMarker.type === 'cleanup' ? 'Cleanup' : 'Issue'}</Text>
            <Text style={styles.previewTitle}>{markerTitle(selectedMarker)}</Text>
            <Text style={styles.previewSubtitle}>{markerSubtitle(selectedMarker)}</Text>
          </View>
        ) : null}

        <Text style={styles.sheetTitle}>{visibleMarkers.length ? 'Nearby activity' : 'No map items yet'}</Text>
        {visibleMarkers.length ? (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {visibleMarkers.map((marker) => (
              <Pressable
                key={`${marker.type}-list-${marker.id}`}
                style={styles.listRow}
                onPress={() => focusMarker(marker)}
              >
                <Text style={[styles.listTitle, selectedMarker?.id === marker.id && styles.listTitleActive]}>{markerTitle(marker)}</Text>
                <Text style={styles.listMeta}>{marker.type === 'cleanup' ? 'Cleanup event' : 'Issue report'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>Submit a report or publish a cleanup event to see activity here.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#edf2f7' },
  mapCanvas: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: '#edf2f7' },
  headerPanel: { position: 'absolute', left: 16, right: 16, top: 56, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: radii.card, borderWidth: 1, borderColor: colors.hairline, padding: 16, ...productShadow },
  eyebrow: { ...type.eyebrow, color: colors.primary },
  headerTitle: { color: colors.ink, fontSize: 22, fontWeight: '700', marginTop: 4 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.parchment, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
  legendText: { color: colors.ink80, fontSize: 12, fontWeight: '600' },
  incidentLegendDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#d93025', marginRight: 7 },
  cleanupLegendDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#0f766e', marginRight: 7 },
  loadingPill: { position: 'absolute', top: 190, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.canvas, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.hairline, ...productShadow },
  markerLoadingPill: { top: 244 },
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  setupPanel: { position: 'absolute', left: 20, right: 20, top: 180, borderRadius: radii.card, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline, padding: 18, ...productShadow },
  setupTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  setupBody: { color: colors.ink80, fontSize: 13, lineHeight: 19, marginTop: 8 },
  setupHint: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 12 },
  setupSteps: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '46%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.canvas, padding: 20, ...productShadow },
  previewCard: { minHeight: 150, borderRadius: radii.card, backgroundColor: colors.tileDark, padding: 18, marginBottom: 16 },
  cleanupPreviewCard: { backgroundColor: '#134e4a' },
  previewKind: { alignSelf: 'flex-start', borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.16)', color: colors.canvas, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  previewTitle: { color: colors.canvas, fontSize: 26, fontWeight: '800', lineHeight: 28, marginTop: 28 },
  previewSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 8 },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  list: { marginTop: 8 },
  listRow: { borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: 12 },
  listTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  listTitleActive: { color: colors.primary },
  listMeta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 8 },
});
