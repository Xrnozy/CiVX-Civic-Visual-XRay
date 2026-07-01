import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';

export default function AccountScreen() {
  const [user, setUser] = useState<{ full_name?: string; role?: string; barangay?: string } | null>(null);

  useEffect(() => {
    api<{ full_name: string; role: string; barangay: string }>('/api/users/me').then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={36} color="#0066cc" />
      </View>
      <Text style={styles.title}>{user?.full_name || 'Guest'}</Text>
      <Text style={styles.meta}>Role: {user?.role || '—'}</Text>
      <Text style={styles.meta}>Barangay: {user?.barangay || '—'}</Text>

      {!user && (
        <Link href="/login" asChild>
          <TouchableOpacity style={styles.signInButton}>
            <Text style={styles.signInText}>Sign in</Text>
          </TouchableOpacity>
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 48,
    backgroundColor: '#f5f5f7',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f2fc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1d1d1f',
  },
  meta: {
    fontSize: 16,
    marginTop: 8,
    color: '#8e8e93',
  },
  signInButton: {
    marginTop: 24,
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  signInText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
