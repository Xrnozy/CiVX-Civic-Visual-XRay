import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Link, usePathname } from 'expo-router';

const actions = [
  { href: '/report', label: 'Report' },
  { href: '/map', label: 'Map' },
  { href: '/events', label: 'Events' },
  { href: '/ecoquest', label: 'EcoQuest' },
  { href: '/passive', label: 'Passive' },
  { href: '/driver', label: 'Driver' },
  { href: '/profile', label: 'Profile' },
  { href: '/login', label: 'Sign In' },
];

export default function HomeScreen() {
  const pathname = usePathname();

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Civic Visual X-Ray</Text>
        <Text style={styles.heroTitle}>Report, verify, and resolve visible city issues.</Text>
        <Text style={styles.heroSubtitle}>
          CiVX helps residents and LGU teams coordinate faster from one clean mobile experience.
        </Text>
      </View>

      <View style={styles.footerMenu}>
        {actions.map((action) => {
          const active = pathname === action.href;
          return (
            <Link key={action.href} href={action.href as never} asChild>
              <TouchableOpacity style={[styles.menuItem, active && styles.menuItemActive]}>
                <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>{action.label}</Text>
              </TouchableOpacity>
            </Link>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, backgroundColor: '#f8fafc' },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  eyebrow: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#0066cc', fontWeight: '600' },
  heroTitle: { fontSize: 30, fontWeight: '700', color: '#0f172a', marginTop: 8, lineHeight: 36 },
  heroSubtitle: { fontSize: 15, color: '#475569', marginTop: 10, lineHeight: 22 },
  footerMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 4,
  },
  menuItem: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 90,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  menuItemActive: {
    borderColor: '#0066cc',
    backgroundColor: '#0066cc',
  },
  menuItemText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  menuItemTextActive: {
    color: '#ffffff',
  },
});
