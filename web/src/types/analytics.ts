export interface AnalyticsSummary {
  total_reports: number;
  total_incidents: number;
  total_resolved: number;
  resolved_count: number;
  avg_response_time_hours: number | null;
  top_barangays: Array<{ barangay: string; count: number }>;
  active_cleanup_events: number;
  by_barangay: Record<string, number>;
  by_status: Record<string, number>;
}

export interface BarangayBreakdownItem {
  barangay: string;
  issue_type: string;
  status: string;
  count: number;
}

export interface BarangayBreakdown {
  items: BarangayBreakdownItem[];
  totals_by_barangay: Record<string, number>;
}

export interface ResponseTimes {
  avg_time_to_verify_hours: number | null;
  avg_time_to_resolve_hours: number | null;
  avg_total_lifecycle_hours: number | null;
  sample_size: {
    time_to_verify: number;
    time_to_resolve: number;
    total_lifecycle: number;
  };
  weekly?: Array<{
    week: string;
    avg_time_to_verify_hours: number | null;
    avg_time_to_resolve_hours: number | null;
    avg_total_lifecycle_hours: number | null;
    sample_size: number;
  }>;
}

export interface ResolvedHistoryItem {
  id: string;
  primary_issue_type: string;
  barangay: string;
  status: string;
  resolved_at: string | null;
  verified_at: string | null;
  created_at: string;
  report_count: number;
  severity_score: number | null;
  department: { id: string; name: string; code: string } | null;
}

export interface ResolvedHistory {
  items: ResolvedHistoryItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface DensityCell {
  lat: number;
  lng: number;
  count: number;
  barangay?: string;
  dominant_issue_type?: string;
}

export interface DensityData {
  mode: 'barangay' | 'grid';
  cells: DensityCell[];
}

export function formatIssueType(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatStatus(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—';
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}
