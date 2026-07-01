import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import type { ResolvedHistory } from '../../../types/analytics';
import { formatIssueType, formatStatus } from '../../../types/analytics';

export function ResolvedHistoryTable() {
  const [data, setData] = useState<ResolvedHistory | null>(null);
  const [page, setPage] = useState(1);
  const [barangay, setBarangay] = useState('');
  const [issueType, setIssueType] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: '15',
      });
      if (barangay.trim()) params.set('barangay', barangay.trim());
      if (issueType.trim()) params.set('issue_type', issueType.trim());
      const result = await api<ResolvedHistory>(`/api/analytics/resolved-history?${params}`);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, barangay, issueType]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="store-utility-card">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-semibold">Resolved issue history</h2>
          <p className="mt-1 text-sm text-ink-muted-48">Resolved and archived incidents</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded-lg border border-hairline px-3 py-2 text-sm"
            placeholder="Filter barangay"
            value={barangay}
            onChange={(e) => {
              setPage(1);
              setBarangay(e.target.value);
            }}
          />
          <input
            className="rounded-lg border border-hairline px-3 py-2 text-sm"
            placeholder="Filter issue type"
            value={issueType}
            onChange={(e) => {
              setPage(1);
              setIssueType(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-ink-muted-48">
              <th className="py-2 pr-4 font-medium">Issue</th>
              <th className="py-2 pr-4 font-medium">Barangay</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Department</th>
              <th className="py-2 pr-4 font-medium">Resolved</th>
              <th className="py-2 font-medium">Reports</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-6 text-ink-muted-48">Loading…</td>
              </tr>
            )}
            {!loading && (data?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-ink-muted-48">No resolved incidents found.</td>
              </tr>
            )}
            {!loading &&
              data?.items.map((item) => (
                <tr key={item.id} className="border-b border-divider-soft">
                  <td className="py-3 pr-4">{formatIssueType(item.primary_issue_type)}</td>
                  <td className="py-3 pr-4">{item.barangay}</td>
                  <td className="py-3 pr-4">{formatStatus(item.status)}</td>
                  <td className="py-3 pr-4">{item.department?.name ?? '—'}</td>
                  <td className="py-3 pr-4">
                    {item.resolved_at ? new Date(item.resolved_at).toLocaleString() : '—'}
                  </td>
                  <td className="py-3">{item.report_count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && data.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-muted-48">
            Page {data.page} of {data.total_pages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary-pill px-4 py-2 text-sm disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-secondary-pill px-4 py-2 text-sm disabled:opacity-40"
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
