-- External partners (simple directory for non-user sponsors/collaborators)
CREATE TABLE external_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_partners_name ON external_partners(name);

-- Replace user-only junction tables with typed party entry rows
DROP TABLE IF EXISTS ecoquest_task_collaborators;
DROP TABLE IF EXISTS ecoquest_task_sponsors;

CREATE TABLE ecoquest_task_party_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ecoquest_tasks(id) ON DELETE CASCADE,
  party_role TEXT NOT NULL CHECK (party_role IN ('collaborator', 'sponsor')),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('user', 'external', 'manual')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  external_partner_id UUID REFERENCES external_partners(id) ON DELETE SET NULL,
  manual_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (entry_type = 'user' AND user_id IS NOT NULL AND external_partner_id IS NULL AND manual_name IS NULL)
    OR (entry_type = 'external' AND external_partner_id IS NOT NULL AND user_id IS NULL AND manual_name IS NULL)
    OR (entry_type = 'manual' AND manual_name IS NOT NULL AND trim(manual_name) <> '' AND user_id IS NULL AND external_partner_id IS NULL)
  )
);

CREATE INDEX idx_ecoquest_task_party_entries_task ON ecoquest_task_party_entries(task_id);
CREATE INDEX idx_ecoquest_task_party_entries_role ON ecoquest_task_party_entries(task_id, party_role);
