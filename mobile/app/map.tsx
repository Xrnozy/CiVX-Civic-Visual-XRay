import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { api } from '../lib/api';
import { IssueMapMarkerPin } from '../components/map/IssueMapMarkerPin';

const CENTER = {
  latitude: 14.55,
  longitude: 121.03,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  primary_issue_type?: string;
  type: 'incident' | 'cleanup';
  title?: string;
}

export default function MapScreen() {
  const [markers, setMarkers] = useState<MapMarker[]>([]);

  useEffect(() => {
    api<{
      incidents: Array<{ id: string; latitude: number; longitude: number; primary_issue_type: string }>;
      cleanup_events?: Array<{ id: string; latitude: number; longitude: number; title: string }>;
    }>('/api/maps/markers')
      .then((d) => {
        setMarkers([
          ...d.incidents.map((m) => ({ ...m, type: 'incident' as const })),
          ...(d.cleanup_events ?? []).map((e) => ({ ...e, type: 'cleanup' as const })),
        ]);
      })
      .catch(() => setMarkers([]));
  }, []);

  return (
    <View style={styles.flex}>
      <MapView style={styles.flex} initialRegion={CENTER}>
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.primary_issue_type || m.title}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <IssueMapMarkerPin issueType={m.primary_issue_type} markerType={m.type} />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
