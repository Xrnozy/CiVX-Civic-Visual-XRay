import { usePolling } from '../../hooks/useDashboardSocket';

export default function LGUAnalyticsPage() {
  const summary = usePolling<{ by_barangay: Record<string, number>; by_status: Record<string, number> }>('/api/analytics/summary');
  const volunteers = usePolling<Array<{ user_id: string; hours: number }>>('/api/analytics/volunteers/top');

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="text-[34px] font-semibold">Analytics</h1>
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div className="store-utility-card">
          <h2 className="font-semibold">By Barangay</h2>
          <ul className="mt-4 space-y-2">
            {Object.entries(summary?.by_barangay || {}).map(([b, c]) => (
              <li key={b} className="flex justify-between text-sm"><span>{b}</span><span>{c}</span></li>
            ))}
          </ul>
        </div>
        <div className="store-utility-card">
          <h2 className="font-semibold">Top Volunteers</h2>
          <ul className="mt-4 space-y-2">
            {(volunteers || []).map((v) => (
              <li key={v.user_id} className="flex justify-between text-sm"><span>{v.user_id.slice(0, 8)}…</span><span>{v.hours}h</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
