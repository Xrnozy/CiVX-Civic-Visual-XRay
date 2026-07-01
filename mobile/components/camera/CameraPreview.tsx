import { forwardRef } from 'react';
import { Platform } from 'react-native';
import ExpoCameraPreview from './ExpoCameraPreview';
import ExternalCameraWebView from './ExternalCameraWebView';
import WebMediaCameraPreview from './WebMediaCameraPreview';
import type { CameraPreviewHandle } from '../../types/camera';
import type { VideoInput } from '../../types/camera';

type Props = {
  source: VideoInput;
  active: boolean;
};

const CameraPreview = forwardRef<CameraPreviewHandle, Props>(function CameraPreview(
  { source, active },
  ref,
) {
  if (source.kind === 'phone-back') {
    return <ExpoCameraPreview ref={ref} facing="back" active={active} />;
  }

  if (source.kind === 'phone-front') {
    return <ExpoCameraPreview ref={ref} facing="front" active={active} />;
  }

  if (source.kind === 'external-stream') {
    return (
      <ExternalCameraWebView
        ref={ref}
        active={active}
        streamUrl={source.streamUrl}
      />
    );
  }

  if (Platform.OS === 'web') {
    return <WebMediaCameraPreview ref={ref} deviceId={source.deviceId} active={active} />;
  }

  return (
    <ExternalCameraWebView
      ref={ref}
      active={active}
      deviceId={source.deviceId}
    />
  );
});

export default CameraPreview;
