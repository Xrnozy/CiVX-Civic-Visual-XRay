import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../styles/theme';

const PRIMARY = colors.primary;
const INACTIVE = colors.muted;

type TabConfig = {
  routeName: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconFocused?: keyof typeof Ionicons.glyphMap;
  center?: boolean;
};

const TABS: TabConfig[] = [
  { routeName: 'index', label: 'Home', icon: 'home-outline', iconFocused: 'home' },
  { routeName: 'events', label: 'Events', icon: 'calendar-outline', iconFocused: 'calendar' },
  { routeName: 'camera', label: 'Camera', center: true },
  { routeName: 'map', label: 'Map', icon: 'map-outline', iconFocused: 'map' },
  { routeName: 'ecoquest', label: 'EcoQuest', icon: 'leaf-outline', iconFocused: 'leaf' },
];

export default function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const routeIndex = state.routes.findIndex((r) => r.name === tab.routeName);
          if (routeIndex === -1) return null;

          const route = state.routes[routeIndex];
          const focused = state.index === routeIndex;
          const color = focused ? PRIMARY : INACTIVE;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (tab.center) {
            return (
              <Pressable
                key={tab.routeName}
                onPress={onPress}
                style={styles.centerSlot}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: focused }}
              >
                <View style={[styles.centerButton, focused && styles.centerButtonFocused]}>
                  <Ionicons name="camera" size={26} color="#ffffff" />
                </View>
                <Text style={[styles.label, { color: focused ? PRIMARY : INACTIVE }]}>{tab.label}</Text>
              </Pressable>
            );
          }

          const iconName = focused ? tab.iconFocused! : tab.icon!;

          return (
            <Pressable
              key={tab.routeName}
              onPress={onPress}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: focused }}
            >
              <Ionicons name={iconName} size={24} color={color} />
              <Text style={[styles.label, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingHorizontal: 8,
    minHeight: 56,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
    gap: 4,
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    marginTop: -22,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  centerButtonFocused: {
    transform: [{ scale: 1.04 }],
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
});
