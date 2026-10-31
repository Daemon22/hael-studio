CREATE TABLE IF NOT EXISTS hael_projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO hael_projects (id, name)
SELECT id, snapshot->>'name'
FROM hael_workspaces
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS hael_project_memberships (
  project_id text NOT NULL REFERENCES hael_projects(id) ON DELETE CASCADE,
  subject text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  granted_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, subject)
);
CREATE INDEX IF NOT EXISTS hael_project_memberships_subject_idx
  ON hael_project_memberships (subject, project_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hael_workspaces_project_fk'
  ) THEN
    ALTER TABLE hael_workspaces
      ADD CONSTRAINT hael_workspaces_project_fk
      FOREIGN KEY (id) REFERENCES hael_projects(id) ON DELETE CASCADE;
  END IF;
END $$;
