CREATE TABLE IF NOT EXISTS hael_project_repositories (
  project_id text PRIMARY KEY REFERENCES hael_projects(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'github' CHECK (provider = 'github'),
  repository text NOT NULL CHECK (repository ~ '^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$'),
  branch text NOT NULL CHECK (length(branch) BETWEEN 1 AND 128 AND branch !~ '(^|/)\.\.(/|$)'),
  connected_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
