ALTER TABLE hael_build_jobs ADD COLUMN IF NOT EXISTS source_repository text;
ALTER TABLE hael_build_jobs ADD COLUMN IF NOT EXISTS source_branch text;

ALTER TABLE hael_build_jobs
  ADD CONSTRAINT hael_build_jobs_source_binding_pair_check
  CHECK ((source_repository IS NULL) = (source_branch IS NULL));
