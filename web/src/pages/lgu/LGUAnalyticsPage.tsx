import { usePolling } from '../../hooks/useDashboardSocket';
import { useAuth } from '../../hooks/useAuth';
import { AnalyticsSummaryCards } from '../../components/lgu/analytics/AnalyticsSummaryCards';
import { BarangayBreakdownChart } from '../../components/lgu/analytics/BarangayBreakdownChart';
import { ResponseTimePanel } from '../../components/lgu/analytics/ResponseTimePanel';
import { ResolvedHistoryTable } from '../../components/lgu/analytics/ResolvedHistoryTable';
import { DensityDataPanel } from '../../components/lgu/analytics/DensityDataPanel';
import type {
  AnalyticsSummary,
  BarangayBreakdown,
  DensityData,
  ResponseTimes,
} from '../../types/analytics';

export default function LGUAnalyticsPage() {
  const { user, ready } = useAuth();
  const enabled = ready && !!user;

  const summary = usePolling<AnalyticsSummary>('/api/analytics/summary', 15000, enabled);
  const byBarangay = usePolling<BarangayBreakdown>('/api/analytics/by-barangay', 15000, enabled);
  const responseTimes = usePolling<ResponseTimes>(
    '/api/analytics/response-times?bucket=weekly',
    15000,
    enabled,
  );
  const density = usePolling<DensityData>('/api/analytics/density?mode=grid', 15000, enabled);

  return (
    <div className="mx-auto max-w-[1440px] p-6 pb-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">LGU Analytics</p>
      <h1 className="mt-2 text-[34px] font-semibold tracking-tight">Analytics dashboard</h1>
      <p className="mt-2 text-ink-muted-80">
        Reports by barangay, response times, resolved history, and density data for problem areas.
      </p>

      <div className="mt-8">
        <AnalyticsSummaryCards summary={summary} />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <BarangayBreakdownChart data={byBarangay} />
        <ResponseTimePanel data={responseTimes} />
      </div>

      <div className="mt-8">
        <ResolvedHistoryTable />
      </div>

      <div className="mt-8">
        <DensityDataPanel data={density} />
      </div>
    </div>
  );
}
