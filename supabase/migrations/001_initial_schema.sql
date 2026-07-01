-- CiVX Initial Schema with PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enums
CREATE TYPE user_role AS ENUM (
  'citizen', 'volunteer', 'organizer', 'lgu_admin', 'lgu_staff',
  'field_worker', 'driver', 'street_sweeper'
);

CREATE TYPE incident_status AS ENUM (
  'detected', 'pending_review', 'verified', 'assigned', 'ongoing', 'resolved', 'archived'
);

CREATE TYPE report_status AS ENUM (
  'pending', 'verified', 'rejected', 'merged'
);

CREATE TYPE incident_source AS ENUM ('citizen', 'passive', 'driver');

CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'changes_requested');

CREATE TYPE attendance_status AS ENUM (
  'registered', 'checked_in', 'checked_out', 'verified', 'rejected'
);

CREATE TYPE route_mode AS ENUM ('passive', 'driver');

CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TYPE ecoquest_status AS ENUM ('open', 'in_progress', 'pending_review', 'approved', 'rejected', 'closed');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  email TEXT,
  role user_role NOT NULL DEFAULT 'citizen',
  barangay TEXT,
  profile_photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  issue_types TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Incidents
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_issue_type TEXT NOT NULL,
  severity_score NUMERIC(5,2) DEFAULT 0,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  barangay TEXT,
  status incident_status NOT NULL DEFAULT 'pending_review',
  report_count INTEGER NOT NULL DEFAULT 1,
  source incident_source NOT NULL DEFAULT 'citizen',
  assigned_department_id UUID REFERENCES departments(id),
  triage_priority INTEGER DEFAULT 0,
  suggested_department_id UUID REFERENCES departments(id),
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX incidents_location_idx ON incidents USING GIST (location);
CREATE INDEX incidents_status_idx ON incidents (status);
CREATE INDEX incidents_issue_type_idx ON incidents (primary_issue_type);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES users(id),
  issue_type TEXT NOT NULL,
  description TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address_text TEXT,
  photo_url TEXT NOT NULL,
  photo_urls JSONB DEFAULT '[]',
  ai_suggested_type TEXT,
  ai_confidence NUMERIC(5,4),
  ai_bounding_box JSONB,
  ai_severity_score NUMERIC(5,2),
  status report_status NOT NULL DEFAULT 'pending',
  merged_incident_id UUID REFERENCES incidents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reports_location_idx ON reports USING GIST (location);
CREATE INDEX reports_incident_idx ON reports (merged_incident_id);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cleanup events
CREATE TABLE cleanup_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  issue_or_incident_id UUID REFERENCES incidents(id),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  barangay TEXT,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  approval_status approval_status NOT NULL DEFAULT 'pending',
  max_volunteers INTEGER DEFAULT 50,
  qr_code_token TEXT UNIQUE,
  before_photo_url TEXT,
  after_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cleanup_events_location_idx ON cleanup_events USING GIST (location);

-- Volunteer registrations
CREATE TABLE volunteer_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES cleanup_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  full_name TEXT NOT NULL,
  phone_number TEXT,
  barangay TEXT,
  emergency_contact TEXT,
  safety_agreement BOOLEAN NOT NULL DEFAULT false,
  registration_status TEXT NOT NULL DEFAULT 'registered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- Attendance records
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES cleanup_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  check_in_location GEOGRAPHY(POINT, 4326),
  check_in_latitude DOUBLE PRECISION,
  check_in_longitude DOUBLE PRECISION,
  qr_code_id TEXT,
  selfie_url TEXT,
  organizer_status attendance_status NOT NULL DEFAULT 'registered',
  lgu_status attendance_status NOT NULL DEFAULT 'registered',
  calculated_hours NUMERIC(6,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- EcoQuest tasks
CREATE TABLE ecoquest_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  sponsor_department_id UUID REFERENCES departments(id),
  task_type TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  barangay TEXT,
  required_proof JSONB DEFAULT '{"gps": true, "before_photo": true, "after_photo": true}',
  reward_type TEXT,
  status ecoquest_status NOT NULL DEFAULT 'open',
  qr_code_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- EcoQuest submissions
CREATE TABLE ecoquest_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ecoquest_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  before_photo_url TEXT,
  after_photo_url TEXT,
  check_in_location GEOGRAPHY(POINT, 4326),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verification_notes TEXT,
  reward_eligible BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Passive route sessions
CREATE TABLE passive_route_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  mode route_mode NOT NULL DEFAULT 'passive',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  route_status TEXT NOT NULL DEFAULT 'active',
  device_id TEXT,
  total_chunks INTEGER DEFAULT 0
);

-- Video chunks
CREATE TABLE video_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_session_id UUID NOT NULL REFERENCES passive_route_sessions(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'uploaded',
  processing_status processing_status NOT NULL DEFAULT 'pending',
  gps_trace_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Detection results
CREATE TABLE detection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_chunk_id UUID REFERENCES video_chunks(id) ON DELETE CASCADE,
  report_id UUID REFERENCES reports(id),
  detected_issue_type TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL,
  severity_score NUMERIC(5,2),
  bounding_box_json JSONB,
  frame_timestamp DOUBLE PRECISION,
  matched_latitude DOUBLE PRECISION,
  matched_longitude DOUBLE PRECISION,
  incident_id UUID REFERENCES incidents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Road anomaly events (Driver Mode)
CREATE TABLE road_anomaly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_session_id UUID NOT NULL REFERENCES passive_route_sessions(id) ON DELETE CASCADE,
  video_chunk_id UUID REFERENCES video_chunks(id),
  event_type TEXT NOT NULL,
  magnitude NUMERIC(8,4),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL,
  ai_confirmed BOOLEAN DEFAULT false,
  incident_id UUID REFERENCES incidents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Department assignments
CREATE TABLE department_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id),
  assigned_by_user_id UUID NOT NULL REFERENCES users(id),
  assigned_to_user_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'assigned',
  notes TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- AI corrections (for future training)
CREATE TABLE ai_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  detection_id UUID REFERENCES detection_results(id),
  original_issue_type TEXT NOT NULL,
  corrected_issue_type TEXT NOT NULL,
  corrected_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nearby incidents helper
CREATE OR REPLACE FUNCTION nearby_incidents(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_m DOUBLE PRECISION DEFAULT 25,
  p_issue_type TEXT DEFAULT NULL,
  active_only BOOLEAN DEFAULT TRUE
)
RETURNS SETOF incidents
LANGUAGE sql STABLE
AS $$
  SELECT i.*
  FROM incidents i
  WHERE ST_DWithin(
    i.location,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_m
  )
  AND (p_issue_type IS NULL OR i.primary_issue_type = p_issue_type)
  AND (
    NOT active_only
    OR i.status NOT IN ('resolved', 'archived')
  )
  ORDER BY ST_Distance(i.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography);
$$;

-- Seed departments
INSERT INTO departments (name, code, description, issue_types) VALUES
  ('Solid Waste Management', 'SWM', 'Garbage and waste issues', ARRAY['garbage_pile', 'scattered_trash', 'overflowing_trash_bin', 'illegal_dumping']),
  ('Public Works', 'DPWH', 'Roads and infrastructure', ARRAY['pothole', 'broken_road', 'road_crack', 'uneven_road', 'broken_sidewalk', 'open_manhole']),
  ('Drainage and Flood Control', 'DRAIN', 'Flooding and drainage', ARRAY['flooding', 'clogged_drainage', 'dirty_canal', 'dirty_river']),
  ('Public Safety', 'SAFETY', 'Safety hazards', ARRAY['road_obstruction', 'unsafe_public_area', 'fallen_tree', 'damaged_traffic_sign', 'broken_streetlight']);

-- RLS policies (basic)
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY incidents_public_read ON incidents
  FOR SELECT USING (status IN ('verified', 'assigned', 'ongoing', 'resolved'));

CREATE POLICY users_own_profile ON users
  FOR ALL USING (true);

-- Auto-populate geography from lat/lng
CREATE OR REPLACE FUNCTION set_location_from_coords()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incidents_set_location BEFORE INSERT OR UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION set_location_from_coords();

CREATE TRIGGER reports_set_location BEFORE INSERT OR UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION set_location_from_coords();

CREATE TRIGGER cleanup_events_set_location BEFORE INSERT OR UPDATE ON cleanup_events
  FOR EACH ROW EXECUTE FUNCTION set_location_from_coords();
