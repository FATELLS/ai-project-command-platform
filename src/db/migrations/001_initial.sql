CREATE TABLE templates (
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  PRIMARY KEY (id, version),
  CHECK (json_valid(config_json))
) STRICT;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  theme_json TEXT NOT NULL DEFAULT '{}',
  terminology_json TEXT NOT NULL DEFAULT '{}',
  published_version_id INTEGER,
  draft_version_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY (template_id, template_version) REFERENCES templates(id, version),
  CHECK (json_valid(theme_json)),
  CHECK (json_valid(terminology_json))
) STRICT;

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('platform_admin', 'project_admin', 'project_editor', 'viewer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
) STRICT;

CREATE TABLE project_versions (
  id INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  layer TEXT NOT NULL CHECK (layer IN ('published', 'draft')),
  version_label TEXT NOT NULL,
  source_checksum TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE (project_id, layer, version_label),
  UNIQUE (project_id, id),
  CHECK (json_valid(metadata_json))
) STRICT;

CREATE TABLE project_modules (
  version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  module_type TEXT NOT NULL,
  position INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  data_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (version_id, external_id),
  CHECK (json_valid(data_json))
) STRICT;

CREATE TABLE project_units (
  version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (version_id, external_id),
  UNIQUE (version_id, position),
  CHECK (json_valid(data_json))
) STRICT;

CREATE TABLE project_stages (
  version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  date_label TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (version_id, external_id),
  UNIQUE (version_id, position),
  CHECK (json_valid(data_json))
) STRICT;

CREATE TABLE project_closures (
  version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  date_label TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (version_id, external_id),
  UNIQUE (version_id, position),
  CHECK (json_valid(data_json))
) STRICT;

CREATE TABLE project_tasks (
  version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  unit_external_id TEXT NOT NULL,
  parent_external_id TEXT,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  progress REAL,
  data_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (version_id, external_id),
  UNIQUE (version_id, position),
  FOREIGN KEY (version_id, unit_external_id) REFERENCES project_units(version_id, external_id),
  FOREIGN KEY (version_id, parent_external_id) REFERENCES project_tasks(version_id, external_id) DEFERRABLE INITIALLY DEFERRED,
  CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100)),
  CHECK (json_valid(data_json))
) STRICT;

CREATE TABLE task_links (
  version_id INTEGER NOT NULL,
  task_external_id TEXT NOT NULL,
  depends_on_external_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'depends_on' CHECK (relation_type = 'depends_on'),
  position INTEGER NOT NULL,
  PRIMARY KEY (version_id, task_external_id, depends_on_external_id, relation_type),
  FOREIGN KEY (version_id, task_external_id) REFERENCES project_tasks(version_id, external_id) ON DELETE CASCADE,
  FOREIGN KEY (version_id, depends_on_external_id) REFERENCES project_tasks(version_id, external_id)
) STRICT;

CREATE TABLE project_workstreams (
  version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (version_id, external_id),
  UNIQUE (version_id, position),
  CHECK (json_valid(data_json))
) STRICT;

CREATE TABLE workstream_tasks (
  version_id INTEGER NOT NULL,
  workstream_external_id TEXT NOT NULL,
  task_external_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (version_id, workstream_external_id, task_external_id),
  FOREIGN KEY (version_id, workstream_external_id) REFERENCES project_workstreams(version_id, external_id) ON DELETE CASCADE,
  FOREIGN KEY (version_id, task_external_id) REFERENCES project_tasks(version_id, external_id)
) STRICT;

CREATE TABLE change_proposals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  base_version_id INTEGER NOT NULL REFERENCES project_versions(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  schema_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (json_valid(payload_json))
) STRICT;

CREATE INDEX idx_project_versions_project ON project_versions(project_id, layer, id);
CREATE INDEX idx_project_tasks_unit ON project_tasks(version_id, unit_external_id, position);
CREATE INDEX idx_task_links_target ON task_links(version_id, depends_on_external_id);
CREATE INDEX idx_change_proposals_project ON change_proposals(project_id, status, created_at);

CREATE TRIGGER validate_published_version_pointer
BEFORE UPDATE OF published_version_id ON projects
WHEN NEW.published_version_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'published version must belong to project and published layer')
  WHERE NOT EXISTS (
    SELECT 1 FROM project_versions
    WHERE id = NEW.published_version_id AND project_id = NEW.id AND layer = 'published'
  );
END;

CREATE TRIGGER validate_draft_version_pointer
BEFORE UPDATE OF draft_version_id ON projects
WHEN NEW.draft_version_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'draft version must belong to project and draft layer')
  WHERE NOT EXISTS (
    SELECT 1 FROM project_versions
    WHERE id = NEW.draft_version_id AND project_id = NEW.id AND layer = 'draft'
  );
END;
