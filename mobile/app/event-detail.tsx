import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../lib/api';
import { colors, productShadow, radii, type } from '../styles/theme';

type CleanupEvent = {
  id: string;
  title: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  barangay?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  approval_status?: string;
  max_volunteers?: number;
  before_photo_url?: string;
  after_photo_url?: string;
};

type UserProfile = {
  full_name?: string;
  phone_number?: string;
  barangay?: string;
};

function formatDate(value?: string) {
  if (!value) return 'Schedule pending';
  return new Date(value).toLocaleString();
}

function statusLabel(value?: string) {
  return value?.replace(/_/g, ' ') || 'pending';
}

function ProofImage({ uri, label }: { uri?: string; label: string }) {
  return (
    <View style={styles.proofBlock}>
      <Text style={styles.proofLabel}>{label}</Text>
      {uri ? (
        <Image source={{ uri }} style={styles.proofImage} />
      ) : (
        <View style={styles.proofPlaceholder}>
          <Ionicons name="image-outline" size={24} color={colors.muted} />
          <Text style={styles.proofPlaceholderText}>Proof photo pending</Text>
        </View>
      )}
    </View>
  );
}

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof params.id === 'string' ? params.id : '';
  const [event, setEvent] = useState<CleanupEvent | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    Promise.all([
      api<CleanupEvent>(`/api/cleanup-events/${eventId}`).then(setEvent),
      api<UserProfile>('/api/users/me').then(setProfile).catch(() => setProfile(null)),
    ])
      .catch(() => Alert.alert('Event unavailable', 'Unable to load this cleanup event.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const heroImage = useMemo(() => event?.before_photo_url || event?.after_photo_url || '', [event]);

  async function joinEvent() {
    if (!eventId || !profile) {
      router.push({ pathname: '/login', params: { next: `/event-detail?id=${eventId}` } });
      return;
    }
    setJoining(true);
    try {
      await api(`/api/volunteers/events/${eventId}/register`, {
        method: 'POST',
        body: JSON.stringify({
          full_name: profile.full_name || 'Volunteer',
          phone_number: profile.phone_number,
          barangay: profile.barangay || event?.barangay,
          emergency_contact: '',
          safety_agreement: true,
        }),
      });
      Alert.alert('You are registered', 'This event now appears in your Account volunteer history.');
    } catch (error) {
      Alert.alert('Unable to join', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Event not found</Text>
        <Text style={styles.emptyText}>This cleanup event may no longer be available.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        {heroImage ? (
          <Image source={{ uri: heroImage }} style={styles.heroImage} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Ionicons name="leaf" size={36} color={colors.primary} />
            <Text style={styles.heroPlaceholderText}>Cleanup event</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Approved cleanup</Text>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.description}>{event.description || 'Community cleanup details will be updated by the organizer.'}</Text>

        <View style={styles.detailGrid}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Starts</Text>
              <Text style={styles.detailValue}>{formatDate(event.scheduled_start)}</Text>
            </View>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Ends</Text>
              <Text style={styles.detailValue}>{formatDate(event.scheduled_end)}</Text>
            </View>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Area</Text>
              <Text style={styles.detailValue}>{event.barangay || 'Community area'}</Text>
            </View>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <View style={styles.detailTextWrap}>
              <Text style={styles.detailLabel}>Volunteer slots</Text>
              <Text style={styles.detailValue}>{event.max_volunteers || 50} max volunteers</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{statusLabel(event.approval_status)}</Text>
          </View>
          {event.latitude && event.longitude ? (
            <Text style={styles.coordinates}>{event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</Text>
          ) : null}
        </View>

        <TouchableOpacity style={[styles.joinButton, joining && styles.disabledButton]} onPress={joinEvent} disabled={joining}>
          {joining ? <ActivityIndicator color={colors.canvas} /> : <Text style={styles.joinButtonText}>Join event</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Verification and proof</Text>
        <Text style={styles.sectionCopy}>
          Attendance can be verified through QR check-in, GPS validation, organizer confirmation, before/after photos, and LGU validation.
        </Text>
        <View style={styles.proofGrid}>
          <ProofImage uri={event.before_photo_url} label="Before photo" />
          <ProofImage uri={event.after_photo_url} label="After photo" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.parchment },
  container: { padding: 20, paddingBottom: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.parchment },
  hero: { borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline, ...productShadow },
  heroImage: { width: '100%', height: 230, backgroundColor: colors.parchment },
  heroPlaceholder: { height: 230, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: 10 },
  heroPlaceholderText: { color: colors.primary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { backgroundColor: colors.canvas, borderRadius: radii.card, borderWidth: 1, borderColor: colors.hairline, padding: 20, marginTop: 14 },
  eyebrow: { ...type.eyebrow, color: colors.primary },
  title: { color: colors.ink, fontSize: 30, fontWeight: '600', lineHeight: 36, marginTop: 8 },
  description: { color: colors.ink80, fontSize: 15, lineHeight: 22, marginTop: 10 },
  detailGrid: { gap: 12, marginTop: 18 },
  detailItem: { flexDirection: 'row', gap: 12, backgroundColor: colors.parchment, borderRadius: radii.soft, padding: 14 },
  detailTextWrap: { flex: 1 },
  detailLabel: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  detailValue: { color: colors.ink, fontSize: 15, fontWeight: '600', marginTop: 3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 },
  statusPill: { backgroundColor: colors.successBg, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  statusText: { color: colors.successText, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  coordinates: { color: colors.muted, fontSize: 12 },
  joinButton: { backgroundColor: colors.primary, borderRadius: radii.pill, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  disabledButton: { opacity: 0.72 },
  joinButtonText: { color: colors.canvas, fontSize: 16, fontWeight: '700' },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '600' },
  sectionCopy: { color: colors.ink80, fontSize: 14, lineHeight: 21, marginTop: 8 },
  proofGrid: { gap: 12, marginTop: 16 },
  proofBlock: { gap: 8 },
  proofLabel: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  proofImage: { width: '100%', height: 160, borderRadius: 8, backgroundColor: colors.parchment },
  proofPlaceholder: { height: 130, borderRadius: 8, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center', gap: 8 },
  proofPlaceholderText: { color: colors.muted, fontSize: 13 },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 14, marginTop: 6, textAlign: 'center' },
});
