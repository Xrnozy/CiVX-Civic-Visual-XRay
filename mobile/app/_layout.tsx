import { Stack } from 'expo-router';

const headerOptions = {
  headerStyle: { backgroundColor: '#ffffff' },
  headerTintColor: '#0066cc',
  headerTitleStyle: { fontWeight: '600' as const, color: '#1d1d1f' },
  contentStyle: { backgroundColor: '#f5f5f7' },
};

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ ...headerOptions, headerShown: true, title: 'Sign in' }} />
      <Stack.Screen name="report" options={{ ...headerOptions, headerShown: true, title: 'Report issue' }} />
      <Stack.Screen name="ecoquest" options={{ ...headerOptions, headerShown: true, title: 'EcoQuest' }} />
      <Stack.Screen name="event-detail" options={{ ...headerOptions, headerShown: true, title: 'Event check-in' }} />
      <Stack.Screen name="passive" options={{ ...headerOptions, headerShown: true, title: 'Passive recording' }} />
      <Stack.Screen name="driver" options={{ ...headerOptions, headerShown: true, title: 'Driver dashcam' }} />
    </Stack>
  );
}
