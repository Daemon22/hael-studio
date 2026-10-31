ALTER TABLE hael_runtime_observations
  ADD COLUMN IF NOT EXISTS stream_id text NOT NULL DEFAULT 'legacy';

ALTER TABLE hael_runtime_observations
  DROP CONSTRAINT IF EXISTS hael_runtime_observations_build_id_sequence_key;

ALTER TABLE hael_runtime_observations
  DROP CONSTRAINT IF EXISTS hael_runtime_observations_build_stream_sequence_unique;

ALTER TABLE hael_runtime_observations
  ADD CONSTRAINT hael_runtime_observations_build_stream_sequence_unique
  UNIQUE (build_id, stream_id, sequence);
