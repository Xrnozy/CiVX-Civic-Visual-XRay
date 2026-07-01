import { Stack } from 'expo-router';
import { colors } from '../styles/theme';

const headerOptions = {
  headerStyle: { backgroundColor: colors.canvas },
  headerTintColor: colors.primary,
  headerTitleStyle: { fontWeight: '600' as const, color: colors.ink },
  contentStyle: { backgroundColor: colors.parchment },
};

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ ...headerOptions, headerShown: true, title: 'Sign in' }} />
      <Stack.Screen name="report" options={{ ...headerOptions, headerShown: true, title: 'Report issue' }} />
      <Stack.Screen name="event-detail" options={{ ...headerOptions, headerShown: true, title: 'Event check-in' }} />
      <Stack.Screen name="passive" options={{ ...headerOptions, headerShown: true, title: 'Passive recording' }} />
      <Stack.Screen name="driver" options={{ ...headerOptions, headerShown: true, title: 'Driver dashcam' }} />
    </Stack>
  );
}
