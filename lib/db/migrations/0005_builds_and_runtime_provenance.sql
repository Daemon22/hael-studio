CREATE TABLE IF NOT EXISTS hael_build_jobs (
  id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES hael_projects(id) ON DELETE CASCADE,
  requested_by text NOT NULL,
  idempotency_key text NOT NULL,
  source_commit text NOT NULL,
  semantic_revision integer NOT NULL CHECK (semantic_revision >= 0),
  artifact_manifest_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  runner_job_id text,
  preview_url text,
  output_manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  diagnostics text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE (project_id, id),
  UNIQUE (project_id, idempotency_key),
  UNIQUE (runner_job_id)
);
CREATE INDEX IF NOT EXISTS hael_build_jobs_project_created_idx
  ON hael_build_jobs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hael_build_jobs_status_created_idx
  ON hael_build_jobs (status, created_at);

CREATE TABLE IF NOT EXISTS hael_runtime_observations (
  id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES hael_projects(id) ON DELETE CASCADE,
  build_id uuid NOT NULL REFERENCES hael_build_jobs(id) ON DELETE CASCADE,
  actor_subject text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 0),
  runtime_id text NOT NULL,
  event_type text NOT NULL,
  artifact_path text NOT NULL,
  artifact_hash text NOT NULL,
  semantic_node_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  detail text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, build_id) REFERENCES hael_build_jobs(project_id, id) ON DELETE CASCADE,
  UNIQUE (build_id, sequence)
);
CREATE INDEX IF NOT EXISTS hael_runtime_observations_project_time_idx
  ON hael_runtime_observations (project_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS hael_runtime_observations_build_sequence_idx
  ON hael_runtime_observations (build_id, sequence);
