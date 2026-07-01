import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { CameraView } from 'expo-camera';
import type { CameraPreviewHandle } from '../../types/camera';

type Props = {
  facing: 'front' | 'back';
  active: boolean;
};

const ExpoCameraPreview = forwardRef<CameraPreviewHandle, Props>(function ExpoCameraPreview(
  { facing, active },
  ref,
) {
  const cameraRef = useRef<CameraView | null>(null);

  useImperativeHandle(ref, () => ({
    async recordAsync({ maxDuration }) {
      if (!cameraRef.current) return undefined;
      const recorded = await cameraRef.current.recordAsync({ maxDuration });
      return recorded?.uri ? { uri: recorded.uri } : undefined;
    },
    async stopRecording() {
      try {
        await cameraRef.current?.stopRecording();
      } catch {
        // ignore stop errors
      }
    },
  }), []);

  if (!active) return null;

  return (
    <CameraView
      style={styles.camera}
      ref={cameraRef}
      mode="video"
      facing={facing}
    />
  );
});

export default ExpoCameraPreview;

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
});
