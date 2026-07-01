import { useEffect, useState } from 'react';
import { Image, View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { colors, productShadow, radii, type } from '../../styles/theme';
import ProfileAvatarButton from '../../components/ProfileAvatarButton';

interface Event {
  id: string;
  title: string;
  description?: string;
  scheduled_start: string;
  scheduled_end?: string;
  barangay?: string;
  max_volunteers?: number;
  before_photo_url?: string;
  after_photo_url?: string;
}

function eventImage(event: Event) {
  return event.before_photo_url || event.after_photo_url || '';
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
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.86}
            onPress={() => router.push({ pathname: '/event-detail', params: { id: item.id } })}
          >
            {eventImage(item) ? (
              <Image source={{ uri: eventImage(item) }} style={styles.cardImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="leaf" size={26} color={colors.primary} />
                <Text style={styles.imagePlaceholderText}>Cleanup event</Text>
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.meta}>{item.barangay || 'Community area'} - {new Date(item.scheduled_start).toLocaleString()}</Text>
              {item.description ? <Text style={styles.description} numberOfLines={2}>{item.description}</Text> : null}
              <View style={styles.cardFooter}>
                <View style={styles.badge}><Text style={styles.badgeText}>View details</Text></View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </View>
            </View>
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
  card: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.card, marginBottom: 14, overflow: 'hidden' },
  cardImage: { width: '100%', height: 150, backgroundColor: colors.parchment },
  imagePlaceholder: { height: 150, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imagePlaceholderText: { color: colors.primary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardBody: { padding: 18 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20 },
  description: { fontSize: 14, color: colors.ink80, marginTop: 8, lineHeight: 20 },
  cardFooter: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 6, paddingHorizontal: 10 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
