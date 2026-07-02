import { DetectionPreviewOverlay } from '../analyzer/DetectionPreviewOverlay';
import type { AnalyzerBoundingBox } from '../../types/analyzer';
import type { OverlayRegion } from '../analyzer/DetectionPreviewOverlay';

function parseBoundingBox(raw: Record<string, unknown> | null | undefined): AnalyzerBoundingBox | null {
  if (!raw || typeof raw !== 'object') return null;
  const x1 = Number(raw.x1);
  const y1 = Number(raw.y1);
  const x2 = Number(raw.x2);
  const y2 = Number(raw.y2);
  if (![x1, y1, x2, y2].every((n) => Number.isFinite(n)) || x2 <= x1 || y2 <= y1) {
    return null;
  }
  return { x1, y1, x2, y2 };
}

function parseOverlayRegions(
  raw: Record<string, unknown> | null | undefined,
  fallbackLabel?: string,
): OverlayRegion[] {
  if (!raw || typeof raw !== 'object') return [];

  const regionsField = raw.regions;
  if (Array.isArray(regionsField)) {
    const regions: OverlayRegion[] = [];
    for (const entry of regionsField) {
      if (!entry || typeof entry !== 'object') continue;
      const box = parseBoundingBox(entry as Record<string, unknown>);
      if (!box) continue;
      const label = typeof entry.label === 'string' ? entry.label : fallbackLabel;
      regions.push({ box, label });
    }
    if (regions.length > 0) return regions;
  }

  const single = parseBoundingBox(raw);
  if (single) {
    const label = typeof raw.label === 'string' ? raw.label : fallbackLabel;
    return [{ box: single, label }];
  }

  return [];
}

interface Props {
  url: string;
  bbox?: Record<string, unknown> | null;
  label?: string;
  className?: string;
  imageClassName?: string;
  onClick?: () => void;
}

export function ReportEvidencePhoto({ url, bbox, label, className = '', imageClassName = '', onClick }: Props) {
  const regions = parseOverlayRegions(bbox, label);
  const frameClass = imageClassName || 'h-16 w-16 object-cover';

  if (regions.length === 0) {
    return (
      <button type="button" onClick={onClick} className={`shrink-0 overflow-hidden rounded-[8px] ${className}`}>
        <img src={url} alt="Incident evidence" className={frameClass} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`block shrink-0 overflow-hidden rounded-[8px] text-left ${className}`}
    >
      <DetectionPreviewOverlay
        mediaUrl={url}
        mediaKind="image"
        regions={regions}
        className={frameClass.split(' ').filter((c) => c.startsWith('h-') || c.startsWith('w-')).join(' ') || 'h-16 w-16'}
        imageClassName={`${frameClass} h-full w-full`}
      />
    </button>
  );
}
