CREATE TABLE IF NOT EXISTS hael_project_audit_events (
  id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES hael_projects(id) ON DELETE CASCADE,
  actor_subject text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  request_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('succeeded', 'rejected')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hael_project_audit_events_project_created_idx
  ON hael_project_audit_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hael_project_audit_events_actor_created_idx
  ON hael_project_audit_events (actor_subject, created_at DESC);
