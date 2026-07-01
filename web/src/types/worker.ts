export interface PassiveWorkerSummary {
  total_sessions: number;
  total_chunks: number;
  total_detections: number;
  active_session_id: string | null;
}

export interface PassiveSession {
  id: string;
  mode: string;
  started_at: string;
  ended_at?: string | null;
  route_status: string;
  total_chunks: number;
  chunks_completed?: number;
  chunks_pending?: number;
  chunks_failed?: number;
}

export interface PassiveDetection {
  id: string;
  detected_issue_type: string;
  confidence: number;
  severity_score?: number | null;
  matched_latitude?: number | null;
  matched_longitude?: number | null;
  created_at: string;
  session_id: string;
}
