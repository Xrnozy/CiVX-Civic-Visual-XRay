-- EcoQuest task collaborators and sponsors (many-to-many via users).
-- Organizations are not a separate table; organizer accounts carry organization_name on users.

CREATE TABLE ecoquest_task_collaborators (
  task_id UUID NOT NULL REFERENCES ecoquest_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE ecoquest_task_sponsors (
  task_id UUID NOT NULL REFERENCES ecoquest_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX idx_ecoquest_task_collaborators_user ON ecoquest_task_collaborators(user_id);
CREATE INDEX idx_ecoquest_task_sponsors_user ON ecoquest_task_sponsors(user_id);
