export const EXTERNAL_CAMERA_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
    }
    #preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: #000;
    }
    #status {
      position: absolute;
      left: 12px;
      bottom: 12px;
      color: #fff;
      font: 12px/1.4 -apple-system, BlinkMacSystemFont, sans-serif;
      background: rgba(0,0,0,0.55);
      padding: 6px 10px;
      border-radius: 999px;
    }
  </style>
</head>
<body>
  <video id="preview" autoplay playsinline muted></video>
  <div id="status">Connecting camera…</div>
  <script>
    const preview = document.getElementById('preview');
    const statusEl = document.getElementById('status');
    let stream = null;
    let recorder = null;
    let recordChunks = [];
    let recordTimer = null;

    function post(payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    function setStatus(text) {
      statusEl.textContent = text;
    }

    async function stopStream() {
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      if (recordTimer) {
        clearTimeout(recordTimer);
        recordTimer = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      preview.srcObject = null;
    }

    async function startDeviceCamera(deviceId) {
      await stopStream();
      let selectedDeviceId = deviceId || null;

      if (!selectedDeviceId) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const external = devices.find((device) => {
          if (device.kind !== 'videoinput') return false;
          const label = (device.label || '').toLowerCase();
          return /usb|webcam|external|uvc|logitech|hd pro/.test(label);
        });
        if (external) {
          selectedDeviceId = external.deviceId;
        }
      }

      const constraints = {
        audio: false,
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      preview.srcObject = stream;
      setStatus('External camera connected');
      post({ type: 'ready' });
    }

    function startRecording(maxDurationMs) {
      return new Promise((resolve, reject) => {
        if (!stream) {
          reject(new Error('No camera stream available for recording.'));
          return;
        }
        recordChunks = [];
        if (!window.MediaRecorder) {
          reject(new Error('External camera recording is not supported on this WebView.'));
          return;
        }
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm';
        recorder = new MediaRecorder(stream, { mimeType });
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordChunks.push(event.data);
          }
        };
        recorder.onstop = async () => {
          try {
            if (recordTimer) {
              clearTimeout(recordTimer);
              recordTimer = null;
            }
            const blob = new Blob(recordChunks, { type: mimeType });
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result || '';
              const base64 = String(result).split(',')[1] || '';
              resolve({ base64, mimeType });
            };
            reader.onerror = () => reject(new Error('Unable to read recorded video.'));
            reader.readAsDataURL(blob);
          } catch (error) {
            reject(error);
          }
        };
        recorder.onerror = () => reject(new Error('External camera recorder failed.'));
        recorder.start();
        recordTimer = setTimeout(() => {
          if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
          }
        }, maxDurationMs);
      });
    }

    async function handleMessage(raw) {
      try {
        const message = JSON.parse(raw.data);
        if (message.type === 'init-device') {
          await startDeviceCamera(message.deviceId || null);
          return;
        }
        if (message.type === 'record') {
          const result = await startRecording((message.maxDuration || 10) * 1000);
          post({ type: 'recorded-chunk', ...result });
          return;
        }
        if (message.type === 'stop-recording') {
          if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
          }
          return;
        }
        if (message.type === 'stop') {
          await stopStream();
          post({ type: 'stopped' });
        }
      } catch (error) {
        post({ type: 'error', message: error && error.message ? error.message : 'Camera failed.' });
      }
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
    post({ type: 'loaded' });
  </script>
</body>
</html>`;
