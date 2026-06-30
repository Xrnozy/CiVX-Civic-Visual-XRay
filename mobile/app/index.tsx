import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Link } from 'expo-router';

export default function HomeScreen() {
  const actions = [
    { href: '/report', label: 'Report Issue', color: '#0066cc' },
    { href: '/map', label: 'Community Map', color: '#272729' },
    { href: '/events', label: 'Cleanup Events', color: '#0066cc' },
    { href: '/ecoquest', label: 'EcoQuest', color: '#272729' },
    { href: '/passive', label: 'Passive Mode', color: '#0066cc' },
    { href: '/driver', label: 'Driver Mode', color: '#272729' },
    { href: '/profile', label: 'Profile', color: '#0066cc' },
    { href: '/login', label: 'Sign In', color: '#1d1d1f' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.hero}>CiVX</Text>
      <Text style={styles.tagline}>Civic Visual X-Ray for your community</Text>
      {actions.map((a) => (
        <Link key={a.href} href={a.href as never} asChild>
          <TouchableOpacity style={[styles.btn, { backgroundColor: a.color }]}>
            <Text style={styles.btnText}>{a.label}</Text>
          </TouchableOpacity>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  hero: { fontSize: 48, fontWeight: '600', letterSpacing: -0.5 },
  tagline: { fontSize: 17, marginTop: 8, marginBottom: 32, color: '#333' },
  btn: { borderRadius: 999, padding: 16, marginBottom: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17 },
});
