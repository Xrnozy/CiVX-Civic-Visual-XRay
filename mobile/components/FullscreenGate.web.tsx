import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../styles/theme';

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: fullscreen)').matches
    || window.matchMedia?.('(display-mode: standalone)').matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function FullscreenGate() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.sessionStorage.getItem('civx_fullscreen_started') === '1';
    setVisible(!dismissed && !isStandaloneDisplay());
  }, []);

  async function startDemo() {
    window.sessionStorage.setItem('civx_fullscreen_started', '1');
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Some mobile browsers only allow installed PWA fullscreen. Continue normally.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>CiVX Mobile Demo</Text>
        <Text style={styles.title}>Start the field app experience.</Text>
        <Text style={styles.copy}>
          Tap once to enter a fullscreen-style demo. For the cleanest kiosk mode, add this page to your home screen.
        </Text>
        <Pressable style={styles.button} onPress={startDemo} accessibilityRole="button">
          <Text style={styles.buttonText}>Start CiVX Demo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.parchment,
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.card,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 24,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 38,
    marginTop: 10,
  },
  copy: {
    color: colors.ink80,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    marginTop: 22,
  },
  buttonText: {
    color: colors.canvas,
    fontSize: 16,
    fontWeight: '700',
  },
});
