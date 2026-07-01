import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { EXTERNAL_CAMERA_HTML } from './externalCameraHtml';
import type { CameraPreviewHandle } from '../../types/camera';

type Props = {
  deviceId?: string;
  streamUrl?: string;
  active: boolean;
};

type PendingRecord = {
  resolve: (value: { uri: string } | undefined) => void;
  reject: (reason?: unknown) => void;
};

const ExternalCameraWebView = forwardRef<CameraPreviewHandle, Props>(function ExternalCameraWebView(
  { deviceId, streamUrl, active },
  ref,
) {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const pendingRecordRef = useRef<PendingRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  function post(payload: Record<string, unknown>) {
    webViewRef.current?.postMessage(JSON.stringify(payload));
  }

  useEffect(() => {
    readyRef.current = false;
    if (!loaded || !active) return;

    if (streamUrl) {
      post({ type: 'init-stream', streamUrl });
      return;
    }

    post({ type: 'init-device', deviceId: deviceId ?? null });
  }, [active, deviceId, loaded, streamUrl]);

  useImperativeHandle(ref, () => ({
    async recordAsync({ maxDuration }) {
      if (!readyRef.current || streamUrl) {
        return undefined;
      }

      return new Promise((resolve, reject) => {
        pendingRecordRef.current = { resolve, reject };
        post({ type: 'record', maxDuration });
      });
    },
    async stopRecording() {
      post({ type: 'stop' });
    },
  }), [streamUrl]);

  async function handleMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type: string;
        base64?: string;
        mimeType?: string;
        message?: string;
      };

      if (message.type === 'loaded') {
        setLoaded(true);
        return;
      }

      if (message.type === 'ready') {
        readyRef.current = true;
        return;
      }

      if (message.type === 'error') {
        if (pendingRecordRef.current) {
          pendingRecordRef.current.reject(new Error(message.message || 'Camera failed.'));
          pendingRecordRef.current = null;
        }
        return;
      }

      if (message.type === 'recorded-chunk' && message.base64) {
        const extension = message.mimeType?.includes('mp4') ? 'mp4' : 'webm';
        const uri = `${FileSystem.cacheDirectory}drive_chunk_${Date.now()}.${extension}`;
        await FileSystem.writeAsStringAsync(uri, message.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        pendingRecordRef.current?.resolve({ uri });
        pendingRecordRef.current = null;
      }
    } catch (error) {
      pendingRecordRef.current?.reject(error);
      pendingRecordRef.current = null;
    }
  }

  if (!active) return null;

  const androidWebViewProps = Platform.OS === 'android'
    ? {
        onPermissionRequest: (request: { nativeEvent: { grant: (resources: string[]) => void; resources: string[] } }) => {
          request.nativeEvent.grant(request.nativeEvent.resources);
        },
      }
    : {};

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        androidLayerType="hardware"
        onMessage={handleMessage}
        source={{ html: EXTERNAL_CAMERA_HTML }}
        {...androidWebViewProps}
      />
    </View>
  );
});

export default ExternalCameraWebView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});
