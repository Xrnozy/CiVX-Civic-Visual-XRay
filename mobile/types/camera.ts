export type CameraSourceKind = 'phone-back' | 'phone-front' | 'external-device' | 'external-stream';

export type VideoInput = {
  id: string;
  label: string;
  kind: CameraSourceKind;
  deviceId?: string;
  streamUrl?: string;
};

export type CameraRecorderRef = {
  recordAsync: (options: { maxDuration: number }) => Promise<{ uri: string } | undefined>;
  stopRecording: () => Promise<void>;
};

export type CameraPreviewHandle = CameraRecorderRef;
