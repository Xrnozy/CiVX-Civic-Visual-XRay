import { NativeModules, Platform } from 'react-native';

export function isNativeWebRtcAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return Boolean(NativeModules.WebRTCModule);
}

export function getNativeWebRtcMediaDevices() {
  if (!isNativeWebRtcAvailable()) return null;

  try {
    const { mediaDevices } = require('react-native-webrtc') as typeof import('react-native-webrtc');
    return mediaDevices;
  } catch {
    return null;
  }
}
