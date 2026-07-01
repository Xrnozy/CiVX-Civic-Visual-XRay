import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { colors, productShadow } from '../styles/theme';

type Profile = {
  full_name?: string;
  profile_photo_url?: string;
};

function initials(name?: string) {
  if (!name?.trim()) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function ProfileAvatarButton() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    api<Profile>('/api/users/me').then(setProfile).catch(() => setProfile(null));
  }, []);

  const label = useMemo(() => initials(profile?.full_name), [profile?.full_name]);

  return (
    <Pressable
      style={[styles.button, { top: insets.top + 12 }]}
      onPress={() => router.push('/account')}
      accessibilityRole="button"
      accessibilityLabel="Open account"
    >
      {profile?.profile_photo_url ? (
        <Image source={{ uri: profile.profile_photo_url }} style={styles.photo} />
      ) : label ? (
        <Text style={styles.initials}>{label}</Text>
      ) : (
        <Ionicons name="person" size={20} color={colors.primary} />
      )}
      <View style={styles.statusDot} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    ...productShadow,
  },
  initials: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  photo: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  statusDot: {
    position: 'absolute',
    right: 1,
    bottom: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34c759',
    borderWidth: 2,
    borderColor: colors.canvas,
  },
});
