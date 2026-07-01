import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { colors, productShadow, radii, type } from '../../styles/theme';

type UserProfile = {
  full_name?: string;
  role?: string;
  barangay?: string;
};

type MyAttendanceEvent = {
  event_id: string;
  title: string;
  barangay?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  registration_status: string;
  organizer_status: string;
  lgu_status: string;
  check_in_time?: string;
  check_out_time?: string;
  calculated_hours: number;
  verified_hours: number;
  certificate_available: boolean;
};

type MyCertificate = {
  event_id: string;
  title: string;
  barangay?: string;
  service_hours: number;
  verified_at?: string;
};

type AttendanceProfile = {
  events: MyAttendanceEvent[];
  certificates: MyCertificate[];
  summary: {
    total_events: number;
    verified_events: number;
    total_verified_hours: number;
  };
};

function formatDate(value?: string) {
  if (!value) return 'Schedule pending';
  return new Date(value).toLocaleString();
}

function statusLabel(value?: string) {
  return value?.replace(/-/g, ' ').replace(/_/g, ' ') || 'registered';
}

export default function AccountScreen() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<UserProfile>('/api/users/me').then(setUser).catch(() => setUser(null)),
      api<AttendanceProfile>('/api/attendance/me').then(setAttendance).catch(() => setAttendance(null)),
    ]).finally(() => setLoading(false));
  }, []);

  const nextEvents = useMemo(() => attendance?.events ?? [], [attendance?.events]);
  const certificates = attendance?.certificates ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.profileCard}>
        <Text style={styles.eyebrow}>Account</Text>
        <View style={styles.avatar}>
          <Ionicons name="person" size={36} color={colors.primary} />
        </View>
        <Text style={styles.title}>{user?.full_name || 'Guest'}</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Role</Text>
            <Text style={styles.metaValue}>{statusLabel(user?.role)}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Barangay</Text>
            <Text style={styles.metaValue}>{user?.barangay || '-'}</Text>
          </View>
        </View>

        {!user && (
          <Link href="/login" asChild>
            <TouchableOpacity style={styles.signInButton}>
              <Text style={styles.signInText}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        )}
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{attendance?.summary.total_events ?? 0}</Text>
          <Text style={styles.summaryLabel}>Events</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{attendance?.summary.verified_events ?? 0}</Text>
          <Text style={styles.summaryLabel}>Certificates</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{attendance?.summary.total_verified_hours ?? 0}</Text>
          <Text style={styles.summaryLabel}>Hours</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Volunteered events</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
      {!loading && nextEvents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No volunteered events yet</Text>
          <Text style={styles.emptyText}>Events you register for, check into, or complete will appear here.</Text>
        </View>
      ) : null}
      {nextEvents.map((event) => (
        <View key={event.event_id} style={styles.eventCard}>
          <View style={styles.eventTopRow}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <View style={[styles.statusBadge, event.certificate_available && styles.statusBadgeVerified]}>
              <Text style={[styles.statusText, event.certificate_available && styles.statusTextVerified]}>
                {event.certificate_available ? 'Verified' : statusLabel(event.lgu_status)}
              </Text>
            </View>
          </View>
          <Text style={styles.eventMeta}>{event.barangay || 'Community area'}</Text>
          <Text style={styles.eventMeta}>{formatDate(event.scheduled_start)}</Text>
          <View style={styles.eventFooter}>
            <Text style={styles.eventFooterText}>Organizer: {statusLabel(event.organizer_status)}</Text>
            <Text style={styles.eventFooterText}>{event.verified_hours || event.calculated_hours || 0} hrs</Text>
          </View>
        </View>
      ))}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Certificates</Text>
      </View>
      {certificates.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No certificates yet</Text>
          <Text style={styles.emptyText}>LGU-verified attendance certificates will show up here automatically.</Text>
        </View>
      ) : null}
      {certificates.map((certificate) => (
        <View key={certificate.event_id} style={styles.certificateCard}>
          <View style={styles.certificateIcon}>
            <Ionicons name="ribbon" size={22} color={colors.primary} />
          </View>
          <View style={styles.certificateBody}>
            <Text style={styles.certificateTitle}>{certificate.title}</Text>
            <Text style={styles.eventMeta}>{certificate.barangay || 'Community area'} - {certificate.service_hours} verified hrs</Text>
            <Text style={styles.eventMeta}>Verified {formatDate(certificate.verified_at)}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.parchment },
  container: { padding: 20, paddingTop: 48, paddingBottom: 36 },
  profileCard: { backgroundColor: colors.canvas, borderRadius: radii.card, borderWidth: 1, borderColor: colors.hairline, padding: 24, alignItems: 'center', ...productShadow },
  eyebrow: { ...type.eyebrow, color: colors.primary, alignSelf: 'flex-start' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#e8f2fc', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  metaGrid: { width: '100%', marginTop: 20, gap: 10 },
  metaPill: { backgroundColor: colors.parchment, borderRadius: radii.soft, paddingHorizontal: 16, paddingVertical: 14 },
  metaLabel: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  metaValue: { fontSize: 16, color: colors.ink, fontWeight: '600', marginTop: 4, textTransform: 'capitalize' },
  signInButton: { marginTop: 24, backgroundColor: colors.primary, paddingVertical: 13, paddingHorizontal: 32, borderRadius: radii.pill },
  signInText: { color: colors.canvas, fontSize: 16, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  summaryCard: { flex: 1, backgroundColor: colors.canvas, borderRadius: radii.soft, borderWidth: 1, borderColor: colors.hairline, padding: 14 },
  summaryValue: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  summaryLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sectionHeader: { marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '600' },
  loader: { marginVertical: 18 },
  emptyCard: { backgroundColor: colors.canvas, borderRadius: radii.card, borderWidth: 1, borderColor: colors.hairline, padding: 18, marginBottom: 12 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  eventCard: { backgroundColor: colors.canvas, borderRadius: radii.card, borderWidth: 1, borderColor: colors.hairline, padding: 18, marginBottom: 12 },
  eventTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  eventTitle: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  eventMeta: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  statusBadge: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.parchment },
  statusBadgeVerified: { backgroundColor: colors.successBg },
  statusText: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statusTextVerified: { color: colors.successText },
  eventFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  eventFooterText: { color: colors.ink80, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  certificateCard: { flexDirection: 'row', gap: 12, backgroundColor: colors.canvas, borderRadius: radii.card, borderWidth: 1, borderColor: colors.hairline, padding: 16, marginBottom: 12 },
  certificateIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e8f2fc', alignItems: 'center', justifyContent: 'center' },
  certificateBody: { flex: 1 },
  certificateTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', lineHeight: 21 },
});
