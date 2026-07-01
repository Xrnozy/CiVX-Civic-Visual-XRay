import { useEffect } from 'react';
import { router } from 'expo-router';

export default function PassiveModeScreen() {
  useEffect(() => {
    router.replace('/(tabs)/camera');
  }, []);

  return null;
}
