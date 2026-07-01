import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
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
  videoRef?: RefObject<HTMLVideoElement | null>;
  onVideoTimeUpdate?: (time: number) => void;
  className?: string;
}

const BOX_COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#a855f7'];

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

export function DetectionPreviewOverlay({
  mediaUrl,
  mediaKind,
  regions,
  analyzedWidth,
  analyzedHeight,
  videoDetections,
  videoRef: externalVideoRef,
  onVideoTimeUpdate,
  className = '',
}: DetectionPreviewOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef ?? internalVideoRef;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [videoTime, setVideoTime] = useState(0);

  const activeRegions =
    mediaKind === 'video' && videoDetections?.length
      ? regionsForVideoTime(videoDetections, videoTime)
      : regions;

  const drawOverlay = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const media =
      mediaKind === 'image'
        ? (container?.querySelector('img') as HTMLImageElement | null)
        : videoRef.current;
    if (!container || !media || !canvas || !mediaReady) return;

    const naturalWidth =
      mediaKind === 'image'
        ? (media as HTMLImageElement).naturalWidth
        : (media as HTMLVideoElement).videoWidth;
    const naturalHeight =
      mediaKind === 'image'
        ? (media as HTMLImageElement).naturalHeight
        : (media as HTMLVideoElement).videoHeight;
    if (!naturalWidth || !naturalHeight) return;

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
  }, [activeRegions, analyzedHeight, analyzedWidth, mediaKind, mediaReady, videoRef]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, videoTime]);

  useEffect(() => {
    const onResize = () => drawOverlay();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawOverlay]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {mediaKind === 'image' ? (
        <img
          src={mediaUrl}
          alt="Preview with detections"
          className="max-h-[min(70vh,560px)] w-full object-contain"
          onLoad={() => setMediaReady(true)}
        />
      ) : (
        <video
          ref={videoRef}
          src={mediaUrl}
          controls
          className="max-h-[min(70vh,560px)] w-full object-contain"
          onLoadedData={() => setMediaReady(true)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setVideoTime(t);
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

export function regionsForVideoTime(
  detections: AnalyzerDetection[],
  currentTime: number,
): OverlayRegion[] {
  const second = Math.floor(currentTime);
  const active = detections.filter(
    (det) =>
      det.frame_timestamp != null &&
      Math.floor(det.frame_timestamp) === second &&
      hasValidBox(det.bounding_box),
  );
  return active.flatMap((det) =>
    regionsFromDetection(
      det,
      `${det.issue_type.replace(/_/g, ' ')} @ ${formatTime(det.frame_timestamp!)}`,
    ),
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
