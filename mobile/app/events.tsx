import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../lib/api';

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
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>{item.barangay} · {new Date(item.scheduled_start).toLocaleString()}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 18, padding: 16, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 14, color: '#7a7a7a', marginTop: 4 },
});
