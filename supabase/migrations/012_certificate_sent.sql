-- Certificate email tracking and organizer auto-send toggle
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS certificate_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS certificate_sent_to TEXT;

ALTER TABLE cleanup_events
  ADD COLUMN IF NOT EXISTS auto_send_certificates BOOLEAN NOT NULL DEFAULT true;
