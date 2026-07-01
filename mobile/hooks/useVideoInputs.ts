import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getNativeWebRtcMediaDevices } from '../lib/nativeWebRtc';
import type { VideoInput } from '../types/camera';

const PHONE_INPUTS: VideoInput[] = [
  { id: 'phone-back', label: 'Phone rear camera', kind: 'phone-back' },
  { id: 'phone-front', label: 'Phone front camera', kind: 'phone-front' },
];

const EXTERNAL_AUTO: VideoInput = {
  id: 'external-auto',
  label: 'USB / External camera',
  kind: 'external-device',
};

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

function appendExternalDevices(inputs: VideoInput[], devices: MediaDeviceInfo[]) {
  devices
    .filter((device) => device.kind === 'videoinput')
    .forEach((device, index) => {
      const label = device.label || `Camera ${index + 1}`;
      const phoneLike = /front|back|facetime|integrated|wide|telephoto|selfie/i.test(label);
      if (phoneLike && !isExternalLabel(label)) return;

      inputs.push({
        id: `external-device:${device.deviceId}`,
        label: isExternalLabel(label) ? label : `External: ${label}`,
        kind: 'external-device',
        deviceId: device.deviceId,
      });
    });
}

async function enumerateWebInputs(): Promise<VideoInput[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return [...PHONE_INPUTS, EXTERNAL_AUTO];
  }

  try {
    await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch {
    // Permission may be denied; still try to list devices.
  }

  const inputs: VideoInput[] = [...PHONE_INPUTS];
  appendExternalDevices(inputs, await navigator.mediaDevices.enumerateDevices());

  if (!inputs.some((input) => input.kind === 'external-device')) {
    inputs.push(EXTERNAL_AUTO);
  }

  return inputs;
}

async function enumerateNativeInputs(): Promise<VideoInput[]> {
  const inputs: VideoInput[] = [...PHONE_INPUTS];
  const mediaDevices = getNativeWebRtcMediaDevices();

  if (mediaDevices) {
    try {
      const stream = await mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((track) => track.stop());
      appendExternalDevices(inputs, await mediaDevices.enumerateDevices() as MediaDeviceInfo[]);
    } catch {
      // Fall back to the built-in external camera option below.
    }
  }

  if (!inputs.some((input) => input.kind === 'external-device')) {
    inputs.push(EXTERNAL_AUTO);
  }

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
