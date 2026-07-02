import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { api } from '../lib/api';
import { colors, productShadow, radii, type } from '../styles/theme';
import ProfileAvatarButton from './ProfileAvatarButton';

const CENTER = { latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.05, longitudeDelta: 0.05 };

type MarkerType = 'incident' | 'cleanup';

type CommunityMapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  primary_issue_type?: string;
  title?: string;
  type: MarkerType;
  status?: string;
  severity_score?: number;
  report_count?: number;
  source?: string;
  submitter_type?: string;
  created_at?: string;
  preview_photo_url?: string;
  preview_created_at?: string;
  barangay?: string;
  scheduled_start?: string;
};

type MapMarkersResponse = {
  incidents: Array<Omit<CommunityMapMarker, 'type'> & { primary_issue_type: string }>;
  cleanup_events?: Array<Omit<CommunityMapMarker, 'type'> & { title: string }>;
};

const mapStyle = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7a7a7a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f7' }] },
];

function formatLabel(value?: string) {
  return value?.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || 'Unknown';
}

function formatDateBadge(value?: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  return `${month} ${date.getDate()}`;
}

function markerTitle(marker: CommunityMapMarker) {
  return marker.type === 'cleanup' ? marker.title || 'Cleanup event' : formatLabel(marker.primary_issue_type);
}

function markerLocation(marker: CommunityMapMarker) {
  return marker.barangay || (marker.type === 'cleanup' ? 'Community cleanup' : 'Unknown location');
}

function markerSubtitle(marker: CommunityMapMarker) {
  if (marker.type === 'cleanup') return 'Approved cleanup drive';
  const submitter = marker.submitter_type === 'lgu' ? 'LGU' : 'Community member';
  return `${submitter} - ${formatLabel(marker.source || 'unknown')}`;
}

function hasCoordinates(marker: CommunityMapMarker) {
  return typeof marker.latitude === 'number'
    && typeof marker.longitude === 'number'
    && !Number.isNaN(marker.latitude)
    && !Number.isNaN(marker.longitude);
}

function MiniPreviewCard({ marker, onPress }: { marker: CommunityMapMarker; onPress: () => void }) {
  const isCleanup = marker.type === 'cleanup';
  const date = formatDateBadge(isCleanup ? marker.scheduled_start || marker.created_at : marker.preview_created_at || marker.created_at);

  return (
    <Pressable style={styles.previewCard} onPress={onPress}>
      {marker.preview_photo_url ? <Image source={{ uri: marker.preview_photo_url }} style={styles.previewImage} /> : null}
      <View style={[styles.previewBase, isCleanup ? styles.cleanupPreviewBase : styles.incidentPreviewBase]} />
      <View style={styles.previewShade} />
      <Text style={styles.previewLocation} numberOfLines={2}>{markerLocation(marker).toUpperCase()}</Text>
      <View style={styles.previewBottom}>
        <View style={styles.previewCopy}>
          <Text style={styles.previewTitle} numberOfLines={2}>{markerTitle(marker).toUpperCase()}</Text>
          <Text style={styles.previewSubtitle} numberOfLines={1}>{markerSubtitle(marker)}</Text>
        </View>
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{date}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function Pin({ type, selected }: { type: MarkerType; selected: boolean }) {
  const isCleanup = type === 'cleanup';
  return (
    <View style={[styles.pinHalo, isCleanup && styles.cleanupPinHalo, selected && styles.pinHaloSelected]}>
      <View style={[styles.pinCore, isCleanup && styles.cleanupPinCore, selected && styles.pinCoreSelected]}>
        {isCleanup ? <Ionicons name="leaf" size={14} color="#fff" /> : null}
      </View>
    </View>
  );
}

export default function CommunityMapScreen({ showProfile = false }: { showProfile?: boolean }) {
  const [markers, setMarkers] = useState<CommunityMapMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<CommunityMapMarker | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<MapMarkersResponse>('/api/maps/markers')
      .then((data) => {
        if (cancelled) return;
        setMarkers([
          ...data.incidents.map((incident) => ({ ...incident, type: 'incident' as const })),
          ...(data.cleanup_events ?? []).map((event) => ({ ...event, type: 'cleanup' as const })),
        ].filter(hasCoordinates));
      })
      .catch(() => {
        if (!cancelled) setMarkers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => ({
    incidents: markers.filter((marker) => marker.type === 'incident').length,
    cleanups: markers.filter((marker) => marker.type === 'cleanup').length,
  }), [markers]);

  function openSelectedMarker() {
    if (!selectedMarker) return;
    if (selectedMarker.type === 'cleanup') {
      router.push({ pathname: '/event-detail', params: { id: selectedMarker.id } });
    }
  }

  return (
    <View style={styles.screen}>
      {showProfile && <ProfileAvatarButton />}
      <MapView
        style={styles.map}
        initialRegion={CENTER}
        customMapStyle={mapStyle}
        toolbarEnabled={false}
        showsCompass={false}
        onPress={() => setSelectedMarker(null)}
      >
        {markers.map((marker) => (
          <Marker
            key={`${marker.type}-${marker.id}`}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            onPress={(event) => {
              event.stopPropagation();
              setSelectedMarker(marker);
            }}
          >
            <Pin type={marker.type} selected={selectedMarker?.id === marker.id && selectedMarker.type === marker.type} />
          </Marker>
        ))}
      </MapView>

      <View style={styles.headerPanel}>
        <Text style={styles.eyebrow}>Community Map</Text>
        <Text style={styles.headerTitle}>Nearby civic activity</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={styles.incidentLegendDot} />
            <Text style={styles.legendText}>{counts.incidents} issues</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.cleanupLegendDot} />
            <Text style={styles.legendText}>{counts.cleanups} cleanups</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingPill}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading markers</Text>
        </View>
      ) : null}

      {selectedMarker ? (
        <View style={styles.previewWrap} pointerEvents="box-none">
          <MiniPreviewCard marker={selectedMarker} onPress={openSelectedMarker} />
          {selectedMarker.type === 'cleanup' ? (
            <Text style={styles.previewHint}>Tap card to view event details</Text>
          ) : (
            <Text style={styles.previewHint}>Incident preview</Text>
          )}
        </View>
      ) : (
        <View style={styles.footerPanel}>
          <Text style={styles.footerTitle}>Tap a pin for details</Text>
          <Text style={styles.footerSubtitle}>Cleanup pins open a mini card that links to the full event page.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.parchment },
  map: { flex: 1 },
  headerPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 56,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
    ...productShadow,
  },
  eyebrow: { ...type.eyebrow, color: colors.primary },
  headerTitle: { color: colors.ink, fontSize: 22, fontWeight: '700', marginTop: 4 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.parchment, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
  legendText: { color: colors.ink80, fontSize: 12, fontWeight: '600' },
  incidentLegendDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#d93025', marginRight: 7 },
  cleanupLegendDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#0f766e', marginRight: 7 },
  loadingPill: {
    position: 'absolute',
    top: 190,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.canvas,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  pinHalo: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(217,48,37,0.16)', alignItems: 'center', justifyContent: 'center' },
  cleanupPinHalo: { backgroundColor: 'rgba(15,118,110,0.18)' },
  pinHaloSelected: { transform: [{ scale: 1.18 }] },
  pinCore: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#d93025', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cleanupPinCore: { backgroundColor: '#0f766e', width: 28, height: 28, borderRadius: 14 },
  pinCoreSelected: { borderColor: colors.ink },
  previewWrap: { position: 'absolute', left: 16, right: 16, bottom: 28, alignItems: 'center' },
  previewCard: { width: 256, height: 256, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.tileDark, ...productShadow },
  previewBase: { ...StyleSheet.absoluteFillObject },
  incidentPreviewBase: { backgroundColor: '#344054' },
  cleanupPreviewBase: { backgroundColor: '#134e4a' },
  previewImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  previewShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.26)' },
  previewLocation: { position: 'absolute', top: 16, left: 16, right: 16, color: 'rgba(255,255,255,0.95)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, lineHeight: 14 },
  previewBottom: { position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  previewCopy: { flex: 1, minWidth: 0 },
  previewTitle: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 24 },
  previewSubtitle: { color: 'rgba(255,255,255,0.94)', fontSize: 11, fontWeight: '600', marginTop: 8 },
  dateBadge: { flexShrink: 0, borderRadius: radii.pill, backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 11, paddingVertical: 6 },
  dateBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  previewHint: { marginTop: 10, overflow: 'hidden', borderRadius: radii.pill, backgroundColor: 'rgba(29,29,31,0.78)', paddingHorizontal: 12, paddingVertical: 7, color: '#fff', fontSize: 12, fontWeight: '700' },
  footerPanel: { position: 'absolute', left: 16, right: 16, bottom: 20, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: radii.card, padding: 16, borderWidth: 1, borderColor: colors.hairline, ...productShadow },
  footerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  footerSubtitle: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
});
