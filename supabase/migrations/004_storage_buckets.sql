-- Storage buckets required by CiVX (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('report-photos', 'report-photos', true),
  ('video-chunks', 'video-chunks', false),
  ('ecoquest-proofs', 'ecoquest-proofs', false),
  ('cleanup-proofs', 'cleanup-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public read report photos" ON storage.objects;
CREATE POLICY "Public read report photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'report-photos');

DROP POLICY IF EXISTS "Service upload report photos" ON storage.objects;
CREATE POLICY "Service upload report photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'report-photos');
