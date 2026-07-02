import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  hasCustomIssueMarker,
  issueMarkerIconName,
  markerColorForIssue,
} from '../../shared/mapMarkers';

interface Props {
  issueType?: string;
  markerType?: 'incident' | 'cleanup';
}

export function IssueMapMarkerPin({ issueType, markerType = 'incident' }: Props) {
  const color = markerColorForIssue(issueType, markerType);

  if (!hasCustomIssueMarker(issueType, markerType)) {
    return <View style={[styles.dot, { backgroundColor: color }]} />;
  }

  const iconName = issueMarkerIconName(issueType, markerType) as keyof typeof MaterialCommunityIcons.glyphMap;

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <MaterialCommunityIcons name={iconName} size={24} color="#ffffff" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
