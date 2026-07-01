import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { CameraPreviewHandle } from '../../types/camera';

type Props = {
  deviceId?: string;
  active: boolean;
};

const WebMediaCameraPreview = forwardRef<CameraPreviewHandle, Props>(function WebMediaCameraPreview(
  { deviceId, active },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;

    async function start() {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    }

    void start();

    return () => {
      cancelled = true;
      recorderRef.current?.stop();
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [active, deviceId]);

  useImperativeHandle(ref, () => ({
    async recordAsync({ maxDuration }) {
      const stream = streamRef.current;
      if (!stream) return undefined;

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      const chunks: BlobPart[] = [];

      return new Promise((resolve, reject) => {
        const recorder = new MediaRecorder(stream, { mimeType });
        recorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };

        recorder.onstop = async () => {
          try {
            const blob = new Blob(chunks, { type: mimeType });
            const uri = `${FileSystem.cacheDirectory}drive_chunk_${Date.now()}.webm`;
            const base64 = await blobToBase64(blob);
            await FileSystem.writeAsStringAsync(uri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            resolve({ uri });
          } catch (error) {
            reject(error);
          } finally {
            recorderRef.current = null;
          }
        };

        recorder.onerror = () => {
          reject(new Error('Unable to record from external camera.'));
        };

        recorder.start();
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, maxDuration * 1000);
      });
    },
    async stopRecording() {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    },
  }), []);

  if (!active) return null;

  return (
    <View style={styles.container}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          backgroundColor: '#000',
        }}
      />
    </View>
  );
});

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export default WebMediaCameraPreview;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
