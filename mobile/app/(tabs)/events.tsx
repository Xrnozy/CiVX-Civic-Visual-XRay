import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../../lib/api';
import { colors, productShadow, radii, type } from '../../styles/theme';
import ProfileAvatarButton from '../../components/ProfileAvatarButton';

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
    <View style={styles.screen}>
      <ProfileAvatarButton />
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
            <Text style={styles.meta}>{item.barangay || 'Community area'} - {new Date(item.scheduled_start).toLocaleString()}</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>Join</Text></View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.parchment },
  container: { padding: 20, paddingTop: 68, paddingBottom: 24, backgroundColor: colors.parchment },
  headerCard: { backgroundColor: colors.canvas, borderRadius: radii.card, padding: 22, borderWidth: 1, borderColor: colors.hairline, marginBottom: 12, ...productShadow },
  eyebrow: { ...type.eyebrow, color: colors.primary },
  title: { fontSize: 28, fontWeight: '600', color: colors.ink, marginTop: 8, lineHeight: 34 },
  subtitle: { fontSize: 15, color: colors.ink80, marginTop: 8, lineHeight: 22 },
  card: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.card, padding: 18, marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 6, paddingHorizontal: 10, marginTop: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
