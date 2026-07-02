import type { RefObject } from 'react';
import type { AnalyzerDetection, AnalyzerImageResponse } from '../../types/analyzer';
import { DetectionPreviewOverlay, type OverlayRegion } from './DetectionPreviewOverlay';

interface AnalyzerPreviewHeroProps {
  previewUrl: string | null;
  isVideo: boolean;
  showOverlay: boolean;
  imageOverlayRegions: OverlayRegion[];
  imageResult: AnalyzerImageResponse | null;
  detectionWidth?: number | null;
  detectionHeight?: number | null;
  videoDetections: AnalyzerDetection[];
  frameTimestamps?: number[];
  videoRef: RefObject<HTMLVideoElement | null>;
  onVideoTimeUpdate?: (time: number) => void;
}

export function AnalyzerPreviewHero({
  previewUrl,
  isVideo,
  showOverlay,
  imageOverlayRegions,
  imageResult,
  detectionWidth,
  detectionHeight,
  videoDetections,
  frameTimestamps,
  videoRef,
  onVideoTimeUpdate,
}: AnalyzerPreviewHeroProps) {
  if (!previewUrl) {
    return (
      <section className="bg-surface-tile-3 px-6 py-12">
        <div className="map-shell mx-auto flex max-w-5xl min-h-[280px] items-center justify-center bg-black">
          <p className="text-sm text-body-muted">Upload a photo or video to preview</p>
        </div>
        <p className="mx-auto mt-3 max-w-5xl text-center text-xs text-ink-muted-48">
          Passive video: VLM runs at 1 fps (up to 6 keyframes) — boxes snap to each real detection.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-surface-tile-3 px-6 py-8">
      <div className="map-shell mx-auto max-w-5xl overflow-hidden bg-black">
        {showOverlay ? (
          <DetectionPreviewOverlay
            mediaUrl={previewUrl}
            mediaKind={isVideo ? 'video' : 'image'}
            regions={imageOverlayRegions}
            analyzedWidth={imageResult?.image_width ?? detectionWidth}
            analyzedHeight={imageResult?.image_height ?? detectionHeight}
            videoDetections={isVideo ? videoDetections : undefined}
            frameTimestamps={isVideo ? frameTimestamps : undefined}
            videoRef={videoRef}
            onVideoTimeUpdate={onVideoTimeUpdate}
            className="min-h-[min(70vh,560px)]"
          />
        ) : isVideo ? (
          <video
            ref={videoRef}
            src={previewUrl}
            controls
            className="max-h-[min(70vh,560px)] w-full object-contain"
            onTimeUpdate={(e) => onVideoTimeUpdate?.(e.currentTarget.currentTime)}
          />
        ) : (
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-[min(70vh,560px)] w-full object-contain"
          />
        )}
      </div>
      <p className="mx-auto mt-3 max-w-5xl text-center text-xs text-ink-muted-48">
        {isVideo
          ? 'Boxes update at each VLM keyframe (like sparse object detection) — no fake sliding.'
          : 'Segmentation highlight inside detected bounding boxes after analysis.'}
      </p>
    </section>
  );
}
