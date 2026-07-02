import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatCard } from '../../components/ui/StatCard';
import { IncidentDetailPanel, type Incident } from '../../components/lgu/IncidentDetailPanel';
import { IncidentStatusBadge, PriorityBadge, SourceBadge, formatLabel } from '../../components/lgu/IncidentBadges';
import { api } from '../../lib/api';
import { useDashboardSocket } from '../../hooks/useDashboardSocket';
import { ISSUE_CATEGORIES, INCIDENT_STATUSES } from '../../shared/constants';

interface Department {
  id: string;
  name: string;
  code: string;
}

const ACTIVE_STATUSES = ['detected', 'pending_review', 'verified', 'assigned', 'ongoing'];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function mergeQueueUpdates(prev: Incident[], updates: Incident[]): Incident[] {
  const map = new Map(prev.map((i) => [i.id, i]));
  for (const inc of updates) {
    map.set(inc.id, { ...map.get(inc.id), ...inc });
  }
  return Array.from(map.values()).sort((a, b) => (b.triage_priority ?? 0) - (a.triage_priority ?? 0));
}

export default function LGUQueuePage() {
  const [queue, setQueue] = useState<Incident[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [issueFilter, setIssueFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [view, setView] = useState<'active' | 'all'>('active');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (issueFilter) params.set('issue_type', issueFilter);
    if (sourceFilter) params.set('source', sourceFilter);
    if (barangayFilter) params.set('barangay', barangayFilter);
    const qs = params.toString();
    setLoading(true);
    return api<Incident[]>(`/api/incidents${qs ? `?${qs}` : ''}`)
      .then((data) => {
        setQueue(data);
        setSelectedId((prev) => {
          if (prev && data.some((i) => i.id === prev)) return prev;
          return data[0]?.id ?? null;
        });
      })
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  }, [statusFilter, issueFilter, sourceFilter, barangayFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<Department[]>('/api/departments').then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const handleSocketUpdate = useCallback((data: unknown) => {
    setQueue((prev) => mergeQueueUpdates(prev, data as Incident[]));
  }, []);

  useDashboardSocket(handleSocketUpdate);

  const filtered = useMemo(() => {
    if (view === 'all') return queue;
    return queue.filter((i) => ACTIVE_STATUSES.includes(i.status));
  }, [queue, view]);

  const stats = useMemo(() => ({
    total: filtered.length,
    pending: filtered.filter((i) => ['detected', 'pending_review'].includes(i.status)).length,
    verified: filtered.filter((i) => i.status === 'verified').length,
    assigned: filtered.filter((i) => ['assigned', 'ongoing'].includes(i.status)).length,
  }), [filtered]);

  const selected = filtered.find((i) => i.id === selectedId) ?? queue.find((i) => i.id === selectedId);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="page-content">
        <p className="eyebrow">LGU Operations</p>
        <h1 className="text-[34px] font-semibold tracking-tight text-ink">Incident Queue</h1>
        <p className="mt-2 max-w-2xl text-ink-muted-80">
          Review incoming reports, verify duplicates, assign departments, and route cases to field checkers for site inspection.
          Status flow: Detected → Pending Review → Verified → Assigned → Ongoing → Resolved.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="In queue" value={stats.total} />
          <StatCard label="Needs review" value={stats.pending} />
          <StatCard label="Verified" value={stats.verified} />
          <StatCard label="Assigned / ongoing" value={stats.assigned} />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-hairline p-1">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                view === 'active' ? 'bg-primary text-white' : 'text-ink-muted-80'
              }`}
              onClick={() => setView('active')}
            >
              Active queue
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                view === 'all' ? 'bg-primary text-white' : 'text-ink-muted-80'
              }`}
              onClick={() => setView('all')}
            >
              All incidents
            </button>
          </div>
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>{formatLabel(s)}</option>
            ))}
          </select>
          <select className="filter-select" value={issueFilter} onChange={(e) => setIssueFilter(e.target.value)}>
            <option value="">All issue types</option>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{formatLabel(c)}</option>
            ))}
          </select>
          <select className="filter-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">All sources</option>
            <option value="citizen">Citizen</option>
            <option value="passive">Passive video</option>
            <option value="driver">Driver mode</option>
          </select>
          <input
            type="text"
            className="filter-select min-w-[160px]"
            placeholder="Barangay…"
            value={barangayFilter}
            onChange={(e) => setBarangayFilter(e.target.value)}
          />
          <span className="text-sm text-ink-muted-48">{filtered.length} incidents</span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
          <div className="space-y-3">
            {loading && filtered.length === 0 && (
              <p className="text-sm text-ink-muted-48">Loading queue…</p>
            )}
            {!loading && filtered.length === 0 && (
              <div className="store-utility-card text-center text-ink-muted-48">
                No incidents match your filters.
              </div>
            )}
            {filtered.map((inc) => (
              <button
                key={inc.id}
                type="button"
                onClick={() => setSelectedId(inc.id)}
                className={`store-utility-card w-full text-left transition ${
                  selectedId === inc.id ? 'border-primary ring-2 ring-primary/20' : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={inc.triage_priority} />
                      <p className="font-semibold capitalize text-ink">
                        {formatLabel(inc.primary_issue_type)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted-48">
                      {inc.barangay ?? 'Unknown barangay'}
                      {' · '}
                      Severity {inc.severity_score ?? '—'}
                      {' · '}
                      {inc.report_count ?? 1} report{(inc.report_count ?? 1) !== 1 ? 's' : ''}
                      {' · '}
                      {timeAgo(inc.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <IncidentStatusBadge status={inc.status} />
                    <SourceBadge source={inc.source} />
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            {selected ? (
              <IncidentDetailPanel
                incident={selected}
                departments={departments}
                onAction={load}
              />
            ) : (
              <div className="store-utility-card text-center text-ink-muted-48">
                Select an incident to review details, linked reports, and take action.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
