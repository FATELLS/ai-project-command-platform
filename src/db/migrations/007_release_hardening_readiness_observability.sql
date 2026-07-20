ALTER TABLE generation_job_materials ADD COLUMN readiness_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(readiness_json));

CREATE TABLE material_readiness_snapshots (
  id INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  extraction_version INTEGER NOT NULL CHECK (extraction_version > 0),
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready','warning','blocked')),
  missing_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(missing_json) AND json_type(missing_json) = 'array'),
  warnings_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(warnings_json) AND json_type(warnings_json) = 'array'),
  evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json) AND json_type(evidence_json) = 'array'),
  suggestion TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id, material_id) REFERENCES project_materials(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (template_id, template_version) REFERENCES templates(id, version)
) STRICT;

CREATE INDEX idx_material_readiness_current
ON material_readiness_snapshots(project_id, material_id, extraction_version, template_id, template_version, id DESC);

CREATE TABLE operation_traces (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 16 AND 80),
  parent_id TEXT,
  request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 16 AND 80),
  project_id TEXT REFERENCES projects(id),
  user_id TEXT REFERENCES users(id),
  operation TEXT NOT NULL CHECK (length(operation) BETWEEN 1 AND 120),
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('started','succeeded','failed')),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  started_at TEXT NOT NULL,
  finished_at TEXT
) STRICT;

CREATE INDEX idx_operation_traces_request ON operation_traces(request_id, started_at DESC);
CREATE INDEX idx_operation_traces_project ON operation_traces(project_id, started_at DESC);

CREATE TABLE error_events (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 16 AND 80),
  request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 16 AND 80),
  trace_id TEXT,
  project_id TEXT REFERENCES projects(id),
  user_id TEXT REFERENCES users(id),
  method TEXT NOT NULL DEFAULT '',
  route TEXT NOT NULL DEFAULT '',
  status INTEGER NOT NULL CHECK (status BETWEEN 400 AND 599),
  code TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 120),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 500),
  stack_fingerprint TEXT NOT NULL CHECK (length(stack_fingerprint) = 64),
  stack_redacted TEXT NOT NULL CHECK (length(stack_redacted) <= 12000),
  context_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(context_json)),
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_error_events_request ON error_events(request_id, created_at DESC);
CREATE INDEX idx_error_events_project ON error_events(project_id, created_at DESC);
CREATE INDEX idx_error_events_code ON error_events(code, created_at DESC);

CREATE TABLE product_test_runs (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 16 AND 80),
  project_id TEXT REFERENCES projects(id),
  suite_id TEXT NOT NULL CHECK (length(suite_id) BETWEEN 1 AND 80),
  status TEXT NOT NULL CHECK (status IN ('running','passed','failed')),
  requested_by TEXT NOT NULL REFERENCES users(id),
  summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(summary_json)),
  created_at TEXT NOT NULL,
  finished_at TEXT
) STRICT;

CREATE TABLE product_test_case_results (
  run_id TEXT NOT NULL REFERENCES product_test_runs(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL CHECK (length(case_id) BETWEEN 1 AND 120),
  status TEXT NOT NULL CHECK (status IN ('passed','failed','skipped')),
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  request_id TEXT,
  message TEXT NOT NULL DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 999),
  PRIMARY KEY (run_id, case_id)
) STRICT;

CREATE INDEX idx_product_test_runs_project ON product_test_runs(project_id, created_at DESC);
