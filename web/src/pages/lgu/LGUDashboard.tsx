import { usePolling } from '../../hooks/useDashboardSocket';
import { Footer } from '../../components/ui/Footer';
import { StatCard } from '../../components/ui/StatCard';

export default function LGUDashboard() {
  const summary = usePolling<{ total_incidents: number; resolved_count: number; by_status: Record<string, number> }>('/api/analytics/summary');

  return (
    <div className="min-h-screen bg-canvas">
      <div className="page-content">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">LGU Operations</p>
        <h1 className="mt-2 text-[40px] font-semibold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-2 text-ink-muted-80">Monitor incidents, volunteers, and community response in real time.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-4">
          <StatCard label="Total incidents" value={summary?.total_incidents ?? '—'} />
          <StatCard label="Resolved" value={summary?.resolved_count ?? '—'} />
          <StatCard label="Pending review" value={summary?.by_status?.pending_review ?? '—'} />
          <StatCard label="Assigned" value={summary?.by_status?.assigned ?? '—'} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
