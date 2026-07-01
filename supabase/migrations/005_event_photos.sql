-- Event photo gallery (not in spec §14 — added for public event detail pages)
CREATE TABLE event_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES cleanup_events(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  image_url TEXT NOT NULL,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX event_photos_event_id_idx ON event_photos(event_id);
CREATE INDEX event_photos_event_id_hidden_idx ON event_photos(event_id, hidden);

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-photos', 'event-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public read event photos" ON storage.objects;
CREATE POLICY "Public read event photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-photos');

DROP POLICY IF EXISTS "Service upload event photos" ON storage.objects;
CREATE POLICY "Service upload event photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-photos');

DROP POLICY IF EXISTS "Service delete event photos" ON storage.objects;
CREATE POLICY "Service delete event photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'event-photos');
