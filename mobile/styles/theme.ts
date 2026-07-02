import { Platform, ViewStyle } from 'react-native';

export const colors = {
  primary: '#0066cc',
  primaryFocus: '#0071e3',
  primaryOnDark: '#2997ff',
  canvas: '#ffffff',
  parchment: '#f5f5f7',
  pearl: '#fafafc',
  tileDark: '#272729',
  tileDark2: '#2a2a2c',
  ink: '#1d1d1f',
  ink80: '#333333',
  muted: '#7a7a7a',
  bodyMuted: '#cccccc',
  hairline: '#e0e0e0',
  divider: '#f0f0f0',
  danger: '#d92d20',
  successBg: '#ecfdf3',
  successText: '#047857',
};

export const radii = {
  card: 18,
  soft: 14,
  pill: 999,
};

export const productShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  android: { elevation: 8 },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
}) as ViewStyle;

export const type = {
  eyebrow: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
};
