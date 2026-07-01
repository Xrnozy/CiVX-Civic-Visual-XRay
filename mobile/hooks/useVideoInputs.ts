import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VideoInput } from '../types/camera';

const STREAM_URL_KEY = 'civx_external_stream_url';

const PHONE_INPUTS: VideoInput[] = [
  { id: 'phone-back', label: 'Phone rear camera', kind: 'phone-back' },
  { id: 'phone-front', label: 'Phone front camera', kind: 'phone-front' },
];

function isExternalLabel(label: string) {
  const normalized = label.toLowerCase();
  return (
    normalized.includes('usb')
    || normalized.includes('webcam')
    || normalized.includes('external')
    || normalized.includes('uvc')
    || normalized.includes('logitech')
    || normalized.includes('hd pro')
  );
}

async function enumerateWebInputs(): Promise<VideoInput[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return PHONE_INPUTS;
  }

  try {
    await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch {
    // Permission may be denied; still try to list devices.
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs: VideoInput[] = [...PHONE_INPUTS];

  devices
    .filter((device) => device.kind === 'videoinput')
    .forEach((device, index) => {
      const label = device.label || `Camera ${index + 1}`;
      const phoneLike = /front|back|facetime|integrated/i.test(label);
      if (phoneLike) return;

      inputs.push({
        id: `external-device:${device.deviceId}`,
        label: isExternalLabel(label) ? label : `External: ${label}`,
        kind: 'external-device',
        deviceId: device.deviceId,
      });
    });

  return inputs;
}

async function enumerateNativeInputs(): Promise<VideoInput[]> {
  const inputs: VideoInput[] = [...PHONE_INPUTS];

  try {
    const { mediaDevices, registerGlobals } = require('react-native-webrtc');
    registerGlobals();
    await mediaDevices.getUserMedia({ video: true, audio: true });
    const devices = await mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device: MediaDeviceInfo) => device.kind === 'videoinput');

    videoDevices.forEach((device: MediaDeviceInfo, index: number) => {
      const label = device.label || `Camera ${index + 1}`;
      const phoneLike = /front|back|wide|telephoto|selfie/i.test(label);
      if (phoneLike) return;

      inputs.push({
        id: `external-device:${device.deviceId}`,
        label: isExternalLabel(label) ? label : `External: ${label}`,
        kind: 'external-device',
        deviceId: device.deviceId,
      });
    });
  } catch {
    // WebRTC native module unavailable in Expo Go.
  }

  const savedStreamUrl = await AsyncStorage.getItem(STREAM_URL_KEY);
  inputs.push({
    id: 'external-stream',
    label: savedStreamUrl ? 'External stream (saved URL)' : 'External stream URL',
    kind: 'external-stream',
    streamUrl: savedStreamUrl ?? '',
  });

  return inputs;
}

export function useVideoInputs(enabled: boolean) {
  const [inputs, setInputs] = useState<VideoInput[]>(PHONE_INPUTS);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const next = Platform.OS === 'web'
        ? await enumerateWebInputs()
        : await enumerateNativeInputs();
      setInputs(next);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { inputs, loading, refresh };
}

export async function saveExternalStreamUrl(url: string) {
  const trimmed = url.trim();
  if (trimmed) {
    await AsyncStorage.setItem(STREAM_URL_KEY, trimmed);
  } else {
    await AsyncStorage.removeItem(STREAM_URL_KEY);
  }
}

export async function getExternalStreamUrl() {
  return (await AsyncStorage.getItem(STREAM_URL_KEY)) ?? '';
}
