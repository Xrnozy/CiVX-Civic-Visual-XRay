import { useMemo, useState } from 'react';
import { StatCard } from '../ui/StatCard';
import type { AnalyzerDetection, AnalyzerImageResponse, AnalyzerVideoResponse } from '../../types/analyzer';

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function hasValidBox(det: AnalyzerDetection) {
  const b = det.bounding_box;
  return b.x2 > b.x1 && b.y2 > b.y1;
}

interface AnalyzerResultsPanelProps {
  analyzing: boolean;
  imageResult: AnalyzerImageResponse | null;
  videoResult: AnalyzerVideoResponse | null;
  playbackSecond: number;
  onSeekSecond: (second: number) => void;
}

export function AnalyzerResultsPanel({
  analyzing,
  imageResult,
  videoResult,
  playbackSecond,
  onSeekSecond,
}: AnalyzerResultsPanelProps) {
  const [showRawJson, setShowRawJson] = useState(false);
  const detection = imageResult?.detection;
  const videoDetections = videoResult?.detections ?? [];

  const videoSeconds = useMemo(() => {
    if (!videoResult) return [];
    const seconds = new Set<number>();
    for (let i = 0; i < videoResult.frames_analyzed; i++) seconds.add(i);
    for (const det of videoDetections) {
      if (det.frame_timestamp != null) seconds.add(Math.floor(det.frame_timestamp));
    }
    return Array.from(seconds).sort((a, b) => a - b);
  }, [videoResult, videoDetections]);

  const detectionsBySecond = useMemo(() => {
    const map = new Map<number, AnalyzerDetection[]>();
    for (const det of videoDetections) {
      const s = Math.floor(det.frame_timestamp ?? 0);
      const list = map.get(s) ?? [];
      list.push(det);
      map.set(s, list);
    }
    return map;
  }, [videoDetections]);

  const avgConfidence = useMemo(() => {
    if (videoDetections.length) {
      const sum = videoDetections.reduce((n, d) => n + d.confidence, 0);
      return `${((sum / videoDetections.length) * 100).toFixed(0)}%`;
    }
    if (detection) return `${(detection.confidence * 100).toFixed(0)}%`;
    return '—';
  }, [videoDetections, detection]);

  if (!detection && !videoResult && !analyzing) {
    return (
      <div className="store-utility-card bg-canvas">
        <h2 className="text-[21px] font-semibold text-ink">Results</h2>
        <p className="mt-4 text-sm text-ink-muted-48">Load the model, upload media, then analyze.</p>
      </div>
    );
  }

  return (
    <div className="store-utility-card space-y-5 bg-canvas">
      <h2 className="text-[21px] font-semibold text-ink">Results</h2>

      {analyzing && (
        <p className="text-sm text-ink-muted-48">Inference in progress…</p>
      )}

      {(imageResult || videoResult) && !analyzing && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label={videoResult ? 'Seconds sampled' : 'Analysis'}
            value={videoResult ? videoResult.frames_analyzed : 'Image'}
          />
          <StatCard
            label="Detections"
            value={videoResult ? videoDetections.length : detection ? 1 : 0}
          />
          <StatCard label="Avg confidence" value={avgConfidence} />
        </div>
      )}

      {detection && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-[12px] bg-canvas-parchment px-3 py-2">
            <p className="text-xs text-ink-muted-48">Issue</p>
            <p className="font-semibold capitalize text-ink">{formatLabel(detection.issue_type)}</p>
          </div>
          <div className="rounded-[12px] bg-canvas-parchment px-3 py-2">
            <p className="text-xs text-ink-muted-48">Confidence</p>
            <p className="font-semibold text-ink">{(detection.confidence * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-[12px] bg-canvas-parchment px-3 py-2">
            <p className="text-xs text-ink-muted-48">Severity</p>
            <p className="font-semibold text-ink">{detection.severity_score}</p>
          </div>
          <div className="rounded-[12px] bg-canvas-parchment px-3 py-2 sm:col-span-2">
            <p className="text-xs text-ink-muted-48">Bounding box</p>
            <p className="font-mono text-xs text-ink">
              {hasValidBox(detection)
                ? `${detection.bounding_box.x1.toFixed(0)}, ${detection.bounding_box.y1.toFixed(0)} → ${detection.bounding_box.x2.toFixed(0)}, ${detection.bounding_box.y2.toFixed(0)}`
                : 'None'}
            </p>
          </div>
          {!hasValidBox(detection) && (
            <p className="text-xs text-ink-muted-80 sm:col-span-2">
              No coordinates returned — try a specific issue hint and re-analyze.
            </p>
          )}
          {imageResult?.duplicate_hint && (
            <div className="rounded-[12px] bg-canvas-parchment px-3 py-2 sm:col-span-2">
              <p className="text-xs text-ink-muted-48">Duplicate check</p>
              <p className="mt-1 text-xs text-ink-muted-80">
                {imageResult.duplicate_hint.action} ({(imageResult.duplicate_hint.duplicate_score * 100).toFixed(0)}%) —{' '}
                {imageResult.duplicate_hint.reason}
              </p>
            </div>
          )}
        </div>
      )}

      {videoResult && (
        <div className="space-y-3">
          {videoDetections.length === 0 && (
            <p className="text-sm text-ink-muted-48">No detections in this clip.</p>
          )}
          {videoSeconds.length > 0 && (
            <div className="flex flex-wrap gap-2 rounded-full border border-hairline bg-canvas-parchment p-1">
              {videoSeconds.map((sec) => {
                const hits = detectionsBySecond.get(sec) ?? [];
                const active = playbackSecond === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onSeekSecond(sec)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'bg-primary text-white'
                        : hits.length > 0
                          ? 'bg-canvas text-ink hover:border-primary/30'
                          : 'text-ink-muted-48 hover:bg-canvas'
                    }`}
                  >
                    {sec}s{hits.length > 0 ? ` · ${hits.length}` : ''}
                  </button>
                );
              })}
            </div>
          )}
          <ul className="max-h-56 space-y-2 overflow-auto">
            {videoDetections.map((det, index) => (
              <li
                key={`${det.frame_timestamp ?? index}-${det.issue_type}`}
                className="flex cursor-pointer items-center justify-between rounded-[12px] border border-hairline bg-canvas-parchment px-3 py-2 text-sm hover:border-primary/30"
                onClick={() => det.frame_timestamp != null && onSeekSecond(Math.floor(det.frame_timestamp))}
              >
                <span className="font-medium capitalize">{formatLabel(det.issue_type)}</span>
                <span className="font-mono text-xs text-ink-muted-48">
                  {det.frame_timestamp != null ? formatTimestamp(det.frame_timestamp) : '—'} ·{' '}
                  {(det.confidence * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(imageResult || videoResult) && (
        <div className="border-t border-hairline pt-4">
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => setShowRawJson((v) => !v)}
          >
            {showRawJson ? 'Hide' : 'Show'} raw JSON
          </button>
          {showRawJson && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-[12px] bg-canvas-parchment p-3 text-xs text-ink-muted-80">
              {JSON.stringify(imageResult ?? videoResult, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
