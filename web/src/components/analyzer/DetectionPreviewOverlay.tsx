import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { AnalyzerBoundingBox, AnalyzerDetection } from '../../types/analyzer';

export interface OverlayRegion {
  box: AnalyzerBoundingBox;
  label?: string;
  color?: string;
}

interface DetectionPreviewOverlayProps {
  mediaUrl: string;
  mediaKind: 'image' | 'video';
  regions: OverlayRegion[];
  analyzedWidth?: number | null;
  analyzedHeight?: number | null;
  videoDetections?: AnalyzerDetection[];
  frameTimestamps?: number[];
  videoRef?: RefObject<HTMLVideoElement | null>;
  onVideoTimeUpdate?: (time: number) => void;
  className?: string;
}

const BOX_COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#a855f7'];
const TIMESTAMP_EPS = 0.2;

function hasValidBox(box: AnalyzerBoundingBox) {
  return box.x2 > box.x1 && box.y2 > box.y1;
}

function computeObjectContainRect(
  containerW: number,
  containerH: number,
  mediaW: number,
  mediaH: number,
) {
  const scale = Math.min(containerW / mediaW, containerH / mediaH);
  const drawW = mediaW * scale;
  const drawH = mediaH * scale;
  const offsetX = (containerW - drawW) / 2;
  const offsetY = (containerH - drawH) / 2;
  return { scale, offsetX, offsetY, drawW, drawH };
}

function scaleBoxToNatural(
  box: AnalyzerBoundingBox,
  analyzedWidth: number,
  analyzedHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): AnalyzerBoundingBox {
  const scaleX = naturalWidth / analyzedWidth;
  const scaleY = naturalHeight / analyzedHeight;
  return {
    x1: box.x1 * scaleX,
    y1: box.y1 * scaleY,
    x2: box.x2 * scaleX,
    y2: box.y2 * scaleY,
  };
}

function drawSegmentationRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: string,
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const radius = Math.max(w, h) * 0.55;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, `${stroke}66`);
  gradient.addColorStop(0.65, `${stroke}33`);
  gradient.addColorStop(1, `${stroke}12`);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.clip();
  ctx.fillStyle = gradient;
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.restore();

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.stroke();

  ctx.strokeStyle = `${stroke}88`;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, Math.max(0, w - 6), Math.max(0, h - 6), 6);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Which VLM keyframe is "active" at playback time — sample-and-hold like sparse object detection. */
export function activeKeyframeTimestamp(keyframes: number[], currentTime: number): number | null {
  if (!keyframes.length) return null;
  const sorted = [...keyframes].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const ts = sorted[i];
    const start = i === 0 ? 0 : (sorted[i - 1] + ts) / 2;
    const end = i === sorted.length - 1 ? Infinity : (ts + sorted[i + 1]) / 2;
    if (currentTime >= start && currentTime < end) return ts;
  }
  return sorted[sorted.length - 1];
}

export function DetectionPreviewOverlay({
  mediaUrl,
  mediaKind,
  regions,
  analyzedWidth,
  analyzedHeight,
  videoDetections,
  frameTimestamps,
  videoRef: externalVideoRef,
  onVideoTimeUpdate,
  className = '',
}: DetectionPreviewOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef ?? internalVideoRef;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaReadyRef = useRef(false);
  const lastKeyframeRef = useRef<number | null>(null);

  const drawOverlay = useCallback(
    (currentTime = 0) => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      const media =
        mediaKind === 'image'
          ? (container?.querySelector('img') as HTMLImageElement | null)
          : videoRef.current;
      if (!container || !media || !canvas || !mediaReadyRef.current) return;

      const naturalWidth =
        mediaKind === 'image'
          ? (media as HTMLImageElement).naturalWidth
          : (media as HTMLVideoElement).videoWidth;
      const naturalHeight =
        mediaKind === 'image'
          ? (media as HTMLImageElement).naturalHeight
          : (media as HTMLVideoElement).videoHeight;
      if (!naturalWidth || !naturalHeight) return;

      const activeRegions =
        mediaKind === 'video' && videoDetections?.length
          ? regionsForVideoTime(videoDetections, currentTime, frameTimestamps)
          : regions;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const srcW = analyzedWidth && analyzedWidth > 0 ? analyzedWidth : naturalWidth;
      const srcH = analyzedHeight && analyzedHeight > 0 ? analyzedHeight : naturalHeight;
      const { scale, offsetX, offsetY } = computeObjectContainRect(
        rect.width,
        rect.height,
        naturalWidth,
        naturalHeight,
      );

      activeRegions.forEach((region, index) => {
        if (!hasValidBox(region.box)) return;
        const naturalBox = scaleBoxToNatural(region.box, srcW, srcH, naturalWidth, naturalHeight);
        const x = offsetX + naturalBox.x1 * scale;
        const y = offsetY + naturalBox.y1 * scale;
        const w = (naturalBox.x2 - naturalBox.x1) * scale;
        const h = (naturalBox.y2 - naturalBox.y1) * scale;
        // #region agent log
        if (mediaKind === 'video' && index === 0 && Math.floor(currentTime * 2) !== Math.floor((currentTime - 0.01) * 2)) {
          fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',hypothesisId:'H5',location:'DetectionPreviewOverlay.tsx:drawOverlay',message:'box_drawn',data:{currentTime:Math.round(currentTime*100)/100,box:{x1:region.box.x1,y1:region.box.y1,x2:region.box.x2,y2:region.box.y2},screen:{x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)},srcW,srcH,naturalWidth,naturalHeight},timestamp:Date.now()})}).catch(()=>{});
        }
        // #endregion
        const color = region.color || BOX_COLORS[index % BOX_COLORS.length];

        drawSegmentationRegion(ctx, x, y, w, h, color);

        if (region.label) {
          const padding = 6;
          ctx.font = '600 11px system-ui, sans-serif';
          const textW = ctx.measureText(region.label).width;
          const labelH = 18;
          const labelX = Math.max(offsetX, Math.min(x, rect.width - textW - padding * 2 - 4));
          const labelY = Math.max(offsetY, y - labelH - 4);

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(labelX, labelY, textW + padding * 2, labelH, 6);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(region.label, labelX + padding, labelY + 13);
        }
      });
    },
    [analyzedHeight, analyzedWidth, frameTimestamps, mediaKind, regions, videoDetections, videoRef],
  );

  const handleVideoTime = useCallback(
    (t: number) => {
      const keyTs =
        frameTimestamps?.length && videoDetections?.length
          ? activeKeyframeTimestamp(frameTimestamps, t)
          : null;
      const keyframeChanged = keyTs !== lastKeyframeRef.current;
      lastKeyframeRef.current = keyTs;

      // #region agent log
      if (Math.floor(t * 4) !== Math.floor((t - 0.25) * 4)) {
        fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',hypothesisId:'H3',location:'DetectionPreviewOverlay.tsx:handleVideoTime',message:'playback_tick',data:{t:Math.round(t*100)/100,keyTs,keyframeChanged,redraw:keyframeChanged,detectionCount:videoDetections?.length??0},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion

      if (keyframeChanged) {
        drawOverlay(t);
      }
      onVideoTimeUpdate?.(t);
    },
    [drawOverlay, frameTimestamps, onVideoTimeUpdate, videoDetections?.length],
  );

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  useEffect(() => {
    const onResize = () => {
      const t = mediaKind === 'video' ? videoRef.current?.currentTime ?? 0 : 0;
      drawOverlay(t);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawOverlay, mediaKind, videoRef]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {mediaKind === 'image' ? (
        <img
          src={mediaUrl}
          alt="Preview with detections"
          className="max-h-[min(70vh,560px)] w-full object-contain"
          onLoad={() => {
            mediaReadyRef.current = true;
            drawOverlay();
          }}
        />
      ) : (
        <video
          ref={videoRef}
          src={mediaUrl}
          controls
          className="max-h-[min(70vh,560px)] w-full object-contain"
          onLoadedData={() => {
            mediaReadyRef.current = true;
            drawOverlay(videoRef.current?.currentTime ?? 0);
          }}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            handleVideoTime(t);
          }}
          onSeeked={(e) => {
            const t = e.currentTarget.currentTime;
            lastKeyframeRef.current = null;
            drawOverlay(t);
            onVideoTimeUpdate?.(t);
          }}
        />
      )}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" aria-hidden />
    </div>
  );
}

export function regionsFromDetection(
  detection: AnalyzerDetection,
  label?: string,
): OverlayRegion[] {
  const boxes = detection.bounding_boxes?.length
    ? detection.bounding_boxes
    : [detection.bounding_box];
  const issueLabel = label || detection.issue_type.replace(/_/g, ' ');
  return boxes.filter(hasValidBox).map((box, index) => ({
    box,
    label: boxes.length > 1 ? `${issueLabel} #${index + 1}` : issueLabel,
  }));
}

/**
 * Show the VLM box from the active keyframe only — snaps at sample boundaries (YOLO-style hold),
 * never interpolates between frames.
 */
export function regionsForVideoTime(
  detections: AnalyzerDetection[],
  currentTime: number,
  frameTimestamps?: number[],
): OverlayRegion[] {
  const valid = detections.filter(
    (det) => det.frame_timestamp != null && hasValidBox(det.bounding_box),
  );
  if (!valid.length) return [];

  const keyframes =
    frameTimestamps?.length
      ? frameTimestamps
      : [...new Set(valid.map((d) => d.frame_timestamp!))];

  const activeTs = activeKeyframeTimestamp(keyframes, currentTime);
  if (activeTs == null) return [];

  const active = valid.filter(
    (det) => Math.abs(det.frame_timestamp! - activeTs) < TIMESTAMP_EPS,
  );

  // #region agent log
  fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b92e3'},body:JSON.stringify({sessionId:'8b92e3',hypothesisId:'H1-H2-H4',location:'DetectionPreviewOverlay.tsx:regionsForVideoTime',message:'keyframe_snap',data:{currentTime:Math.round(currentTime*100)/100,activeTs,activeCount:active.length,totalDetections:valid.length,keyframes:keyframes.slice(0,8),nearestTs:valid.length?valid.reduce((best,d)=>Math.abs(d.frame_timestamp!-currentTime)<Math.abs(best.frame_timestamp!-currentTime)?d:best).frame_timestamp:null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return active.flatMap((det) =>
    regionsFromDetection(det, det.issue_type.replace(/_/g, ' ')),
  );
}
