import type { DensityData } from '../../../types/analytics';
import { formatIssueType } from '../../../types/analytics';

interface Props {
  data: DensityData | null;
}

export function DensityDataPanel({ data }: Props) {
  const cells = (data?.cells ?? []).slice(0, 12);

  return (
    <div className="store-utility-card">
      <h2 className="font-semibold">Problem-area density data</h2>
      <p className="mt-1 text-sm text-ink-muted-48">
        Active incidents only — JSON feed for heatmap rendering (map UI handled separately).
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-ink-muted-48">
              {data?.mode === 'barangay' ? (
                <th className="py-2 pr-4 font-medium">Barangay</th>
              ) : (
                <>
                  <th className="py-2 pr-4 font-medium">Lat</th>
                  <th className="py-2 pr-4 font-medium">Lng</th>
                </>
              )}
              <th className="py-2 pr-4 font-medium">Count</th>
              {data?.mode === 'grid' && <th className="py-2 font-medium">Dominant issue</th>}
            </tr>
          </thead>
          <tbody>
            {cells.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-ink-muted-48">No active incident clusters.</td>
              </tr>
            )}
            {cells.map((cell, index) => (
              <tr key={`${cell.lat}-${cell.lng}-${index}`} className="border-b border-divider-soft">
                {data?.mode === 'barangay' ? (
                  <td className="py-3 pr-4">{cell.barangay ?? 'Unknown'}</td>
                ) : (
                  <>
                    <td className="py-3 pr-4">{cell.lat}</td>
                    <td className="py-3 pr-4">{cell.lng}</td>
                  </>
                )}
                <td className="py-3 pr-4">{cell.count}</td>
                {data?.mode === 'grid' && (
                  <td className="py-3">
                    {cell.dominant_issue_type ? formatIssueType(cell.dominant_issue_type) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-primary">Preview API payload</summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-canvas-parchment p-3 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
