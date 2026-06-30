import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { api } from '../lib/api';

export default function ProfileScreen() {
  const [user, setUser] = useState<{ full_name?: string; role?: string; barangay?: string } | null>(null);

  useEffect(() => {
    api<{ full_name: string; role: string; barangay: string }>('/api/users/me').then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{user?.full_name || 'Guest'}</Text>
      <Text style={styles.meta}>Role: {user?.role || '—'}</Text>
      <Text style={styles.meta}>Barangay: {user?.barangay || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 34, fontWeight: '600' },
  meta: { fontSize: 17, marginTop: 8, color: '#333' },
});
