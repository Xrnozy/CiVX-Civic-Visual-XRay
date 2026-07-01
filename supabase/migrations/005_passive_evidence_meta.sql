-- Passive pipeline extensions (yolo hit accumulator + evidence metadata)

ALTER TABLE passive_clip_jobs
  ADD COLUMN IF NOT EXISTS yolo_hits_json JSONB NOT NULL DEFAULT '{}';

ALTER TABLE passive_evidence
  ADD COLUMN IF NOT EXISTS capture_mode TEXT,
  ADD COLUMN IF NOT EXISTS session_id UUID,
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS client_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspicion_flags JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_gallery_upload BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS passive_evidence_perceptual_hash_idx ON passive_evidence (perceptual_hash);
