export type CameraSourceKind = 'phone-back' | 'phone-front' | 'external-device';

export type VideoInput = {
  id: string;
  label: string;
  kind: CameraSourceKind;
  deviceId?: string;
};

export type CameraRecorderRef = {
  recordAsync: (options: { maxDuration: number }) => Promise<{ uri: string } | undefined>;
  stopRecording: () => Promise<void>;
};

export type CameraPreviewHandle = CameraRecorderRef;
