import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Link, usePathname } from 'expo-router';

const quickActions = [
  { href: '/report', label: 'Report', caption: 'Capture a visible issue', accent: 'primary' },
  { href: '/ecoquest', label: 'EcoQuest', caption: 'Complete micro-tasks', accent: 'secondary' },
];

const highlights = [
  { title: 'Citizen reporting', body: 'Submit photos and GPS-backed reports in seconds.' },
  { title: 'Community coordination', body: 'Join approved cleanup events and volunteer actions.' },
  { title: 'LGU visibility', body: 'Track progress from detection to resolution in one place.' },
];

export default function HomeScreen() {
  const pathname = usePathname();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.tileLight}>
        <Text style={styles.eyebrow}>CIVIC VISUAL X-RAY</Text>
        <Text style={styles.heroTitle}>Turn city issues into coordinated action.</Text>
        <Text style={styles.heroSubtitle}>
          CiVX helps residents, volunteers, and LGU teams report visible problems, verify them faster, and resolve them together.
        </Text>

        <View style={styles.buttonRow}>
          <Link href="/report" asChild>
            <TouchableOpacity style={styles.buttonPrimary}>
              <Text style={styles.buttonPrimaryText}>Report issue</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/map" asChild>
            <TouchableOpacity style={styles.buttonSecondary}>
              <Text style={styles.buttonSecondaryText}>Explore map</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>24</Text>
            <Text style={styles.statLabel}>Live reports</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Cleanups</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>88%</Text>
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
              <Link key={action.href} href={action.href as never} asChild>
                <TouchableOpacity style={[styles.actionCard, active && styles.actionCardActive]}>
                  <Text style={[styles.actionLabel, active && styles.actionLabelActive]}>{action.label}</Text>
                  <Text style={[styles.actionCaption, active && styles.actionCaptionActive]}>{action.caption}</Text>
                </TouchableOpacity>
              </Link>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: '#f5f5f7',
  },
  tileLight: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    marginBottom: 16,
  },
  tileDark: {
    backgroundColor: '#272729',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    marginBottom: 16,
  },
  tileLightSecondary: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#0066cc',
    textTransform: 'uppercase',
  },
  darkEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#2997ff',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '600',
    color: '#1d1d1f',
    lineHeight: 40,
    marginTop: 10,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 17,
    color: '#333333',
    lineHeight: 25,
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 18,
  },
  buttonPrimary: {
    backgroundColor: '#0066cc',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
    marginRight: 10,
    marginBottom: 10,
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
  },
  buttonSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0066cc',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
    marginBottom: 10,
  },
  buttonSecondaryText: {
    color: '#0066cc',
    fontSize: 15,
    fontWeight: '500',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 18,
  },
  statPill: {
    backgroundColor: '#f5f5f7',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1d1d1f',
  },
  statLabel: {
    fontSize: 12,
    color: '#7a7a7a',
    marginTop: 2,
  },
  darkTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    lineHeight: 30,
    marginTop: 10,
    letterSpacing: -0.2,
  },
  cardList: {
    marginTop: 16,
  },
  infoCard: {
    backgroundColor: '#2a2a2c',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  infoCardBody: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 20,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1d1d1f',
    letterSpacing: -0.2,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#f5f5f7',
    borderRadius: 16,
    padding: 14,
    marginRight: '2%',
    marginBottom: 10,
    minHeight: 90,
    justifyContent: 'center',
  },
  actionCardActive: {
    backgroundColor: '#0066cc',
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1d1d1f',
  },
  actionLabelActive: {
    color: '#ffffff',
  },
  actionCaption: {
    fontSize: 13,
    color: '#7a7a7a',
    marginTop: 4,
    lineHeight: 18,
  },
  actionCaptionActive: {
    color: '#eaf3ff',
  },
});
