-- Passive incident detection pipeline (Redis workers)

CREATE TYPE passive_job_status AS ENUM (
  'queued',
  'trust_checking',
  'prefiltering',
  'yolo_processing',
  'locate_verifying',
  'candidate_created',
  'report_created',
  'needs_review',
  'discarded',
  'failed'
);

CREATE TABLE passive_capture_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  nonce_hash TEXT NOT NULL,
  device_id TEXT,
  user_id UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX passive_capture_sessions_expires_idx ON passive_capture_sessions (expires_at);

CREATE TABLE passive_clip_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status passive_job_status NOT NULL DEFAULT 'queued',
  video_path TEXT NOT NULL,
  sha256 TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  gps_accuracy DOUBLE PRECISION,
  device_id TEXT,
  user_id UUID REFERENCES users(id),
  session_id UUID,
  route_session_id UUID REFERENCES passive_route_sessions(id),
  video_chunk_id UUID REFERENCES video_chunks(id),
  capture_mode TEXT NOT NULL DEFAULT 'passive_camera',
  client_timestamp TIMESTAMPTZ,
  trust_score NUMERIC(4,3) DEFAULT 1.0,
  suspicion_flags JSONB NOT NULL DEFAULT '[]',
  processing_mode TEXT DEFAULT 'normal',
  error_message TEXT,
  gps_trace_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX passive_clip_jobs_status_idx ON passive_clip_jobs (status);
CREATE INDEX passive_clip_jobs_sha256_idx ON passive_clip_jobs (sha256);

CREATE TABLE passive_file_hashes (
  sha256 TEXT PRIMARY KEY,
  job_id UUID REFERENCES passive_clip_jobs(job_id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE passive_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES passive_clip_jobs(job_id) ON DELETE CASCADE,
  frame_path TEXT,
  evidence_url TEXT,
  sha256 TEXT,
  perceptual_hash TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  ai_label TEXT,
  ai_confidence NUMERIC(5,4),
  trust_score NUMERIC(4,3),
  source TEXT,
  verification_status TEXT,
  raw_ai_result JSONB,
  incident_id UUID REFERENCES incidents(id),
  report_id UUID REFERENCES reports(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX passive_evidence_job_idx ON passive_evidence (job_id);

ALTER TABLE detection_results
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES passive_clip_jobs(job_id),
  ADD COLUMN IF NOT EXISTS verification_status TEXT,
  ADD COLUMN IF NOT EXISTS trust_score NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS source TEXT;
