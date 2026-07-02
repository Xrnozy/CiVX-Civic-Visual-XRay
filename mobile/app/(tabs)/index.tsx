import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../lib/api';
import { colors, productShadow, radii, type } from '../../styles/theme';
import ProfileAvatarButton from '../../components/ProfileAvatarButton';

type CommunityImpact = {
  resolved_incidents: number;
  approved_cleanups: number;
  active_incidents: number;
  verification_rate: number;
};

const POLL_MS = 10000;

const quickActions = [
  { href: '/report', label: 'Report', caption: 'Capture a visible issue' },
  { href: '/ecoquest', label: 'EcoQuest', caption: 'Complete micro-tasks' },
];

const highlights = [
  { title: 'Citizen reporting', body: 'Submit photos and GPS-backed reports in seconds.' },
  { title: 'Community coordination', body: 'Join approved cleanup events and volunteer actions.' },
  { title: 'LGU visibility', body: 'Track progress from detection to resolution in one place.' },
];

export default function HomeScreen() {
  const pathname = usePathname();
  const [impact, setImpact] = useState<CommunityImpact | null>(null);

  const loadImpact = useCallback(() => {
    api<CommunityImpact>('/api/analytics/community-impact')
      .then(setImpact)
      .catch(() => setImpact(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadImpact();
      const timer = setInterval(loadImpact, POLL_MS);
      return () => clearInterval(timer);
    }, [loadImpact]),
  );

  const formatStat = (value: number | null | undefined) => (typeof value === 'number' ? String(value) : '-');
  const formatPercent = (value: number | null | undefined) => (typeof value === 'number' ? `${value}%` : '-');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <ProfileAvatarButton />
      <View style={styles.tileLight}>
        <Text style={styles.eyebrow}>Civic Visual X-Ray</Text>
        <Text style={styles.heroTitle}>Turn city issues into coordinated action.</Text>
        <Text style={styles.heroSubtitle}>
          CiVX helps residents, volunteers, and LGU teams report visible problems, verify them faster, and resolve them together.
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.buttonPrimary} onPress={() => router.push('/report')}>
            <Text style={styles.buttonPrimaryText}>Report issue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.push('/map')}>
            <Text style={styles.buttonSecondaryText}>Explore map</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{formatStat(impact?.active_incidents)}</Text>
            <Text style={styles.statLabel}>Live reports</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{formatStat(impact?.approved_cleanups)}</Text>
            <Text style={styles.statLabel}>Cleanups</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{formatPercent(impact?.verification_rate)}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
        </View>
      </View>

      <View style={styles.tileDark}>
        <Text style={styles.darkEyebrow}>What the app supports</Text>
        <Text style={styles.darkTitle}>See nearby issues, join cleanup drives, and keep the response visible.</Text>

        <View style={styles.cardList}>
          {highlights.map((item) => (
            <View key={item.title} style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>{item.title}</Text>
              <Text style={styles.infoCardBody}>{item.body}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.tileLightSecondary}>
        <Text style={styles.sectionTitle}>Fast actions</Text>
        <View style={styles.actionGrid}>
          {quickActions.map((action) => {
            const active = pathname === action.href;
            return (
              <TouchableOpacity
                key={action.href}
                style={[styles.actionCard, active && styles.actionCardActive]}
                onPress={() => router.push(action.href as never)}
              >
                <Text style={[styles.actionLabel, active && styles.actionLabelActive]}>{action.label}</Text>
                <Text style={[styles.actionCaption, active && styles.actionCaptionActive]}>{action.caption}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.parchment },
  container: { paddingHorizontal: 20, paddingTop: 68, paddingBottom: 24, backgroundColor: colors.parchment },
  tileLight: {
    backgroundColor: colors.canvas,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    marginBottom: 16,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...productShadow,
  },
  tileDark: {
    backgroundColor: colors.tileDark,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    marginBottom: 16,
    borderRadius: radii.card,
    ...productShadow,
  },
  tileLightSecondary: {
    backgroundColor: colors.canvas,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  eyebrow: { ...type.eyebrow, color: colors.primary },
  darkEyebrow: { ...type.eyebrow, color: colors.primaryOnDark },
  heroTitle: { fontSize: 34, fontWeight: '600', color: colors.ink, lineHeight: 40, marginTop: 10 },
  heroSubtitle: { fontSize: 17, color: colors.ink80, lineHeight: 25, marginTop: 10 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18 },
  buttonPrimary: { backgroundColor: colors.primary, paddingVertical: 11, paddingHorizontal: 18, borderRadius: radii.pill, marginRight: 10, marginBottom: 10 },
  buttonPrimaryText: { color: colors.canvas, fontSize: 15, fontWeight: '500' },
  buttonSecondary: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.primary, paddingVertical: 11, paddingHorizontal: 18, borderRadius: radii.pill, marginBottom: 10 },
  buttonSecondaryText: { color: colors.primary, fontSize: 15, fontWeight: '500' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18 },
  statPill: { backgroundColor: colors.parchment, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginRight: 8, marginBottom: 8 },
  statValue: { fontSize: 16, fontWeight: '600', color: colors.ink },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  darkTitle: { fontSize: 24, fontWeight: '600', color: colors.canvas, lineHeight: 30, marginTop: 10 },
  cardList: { marginTop: 16 },
  infoCard: { backgroundColor: colors.tileDark2, padding: 14, borderRadius: 14, marginBottom: 10 },
  infoCardTitle: { fontSize: 16, fontWeight: '600', color: colors.canvas },
  infoCardBody: { fontSize: 14, color: colors.bodyMuted, lineHeight: 20, marginTop: 4 },
  sectionTitle: { fontSize: 24, fontWeight: '600', color: colors.ink },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  actionCard: { width: '48%', backgroundColor: colors.parchment, borderRadius: 16, padding: 14, marginRight: '2%', marginBottom: 10, minHeight: 90, justifyContent: 'center' },
  actionCardActive: { backgroundColor: colors.primary },
  actionLabel: { fontSize: 16, fontWeight: '600', color: colors.ink },
  actionLabelActive: { color: colors.canvas },
  actionCaption: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  actionCaptionActive: { color: '#eaf3ff' },
});
