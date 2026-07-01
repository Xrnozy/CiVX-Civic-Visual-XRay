import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../../lib/api';

interface Event {
  id: string;
  title: string;
  scheduled_start: string;
  barangay?: string;
}

export default function EventsScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  useEffect(() => {
    api<Event[]>('/api/cleanup-events?approved_only=true').then(setEvents).catch(() => setEvents([]));
  }, []);

  return (
    <FlatList
      data={events}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>Community cleanup</Text>
          <Text style={styles.title}>Approved events and volunteer drives</Text>
          <Text style={styles.subtitle}>Join a nearby cleanup and help your barangay act faster.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.meta}>{item.barangay || 'Community area'} · {new Date(item.scheduled_start).toLocaleString()}</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>Join</Text></View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 24, backgroundColor: '#f8fafc' },
  headerCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  eyebrow: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#0066cc', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginTop: 6 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 6, lineHeight: 20 },
  card: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 14, color: '#64748b', marginTop: 6, lineHeight: 20 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#0066cc', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, marginTop: 10 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
