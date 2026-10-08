CREATE TABLE IF NOT EXISTS hael_workspaces (
  id text PRIMARY KEY,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hael_workspace_messages (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES hael_workspaces(id) ON DELETE CASCADE,
  message jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hael_workspace_messages_created_at_idx
  ON hael_workspace_messages (workspace_id, created_at);

CREATE TABLE IF NOT EXISTS hael_studio_runtime_states (
  workspace_id text PRIMARY KEY REFERENCES hael_workspaces(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 0
    CONSTRAINT hael_studio_runtime_states_revision_nonnegative CHECK (revision >= 0),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hael_review_requests (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES hael_workspaces(id) ON DELETE CASCADE,
  request jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hael_runtime_events (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES hael_workspaces(id) ON DELETE CASCADE,
  event jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hael_runtime_events_created_at_idx
  ON hael_runtime_events (workspace_id, created_at);
