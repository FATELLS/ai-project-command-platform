-- ============================================================
-- 虚谷数据库版本 — 初始 Schema
-- 从 SQLite 001_initial.sql 转换
-- 转换规则:
--   STRICT 去掉（虚谷无此语法）
--   TEXT -> CLOB
--   INTEGER PRIMARY KEY -> INTEGER IDENTITY(1,1) PRIMARY KEY
--   AUTOINCREMENT -> SEQUENCE/IDENTITY
--   CHECK(json_valid()) -> 保留（虚谷有 JSON_VALID 函数）
--   GLOB -> LIKE (虚谷支持)
--   COLLATE NOCASE -> 去掉（用 UPPER() 代替）
--   ON CONFLICT -> MERGE
--   RAISE(ABORT,...) -> SIGNAL SQLSTATE
--   DEFERRABLE INITIALLY DEFERRED -> DEFERRABLE
-- ============================================================

CREATE TABLE templates (
  id VARCHAR(128) NOT NULL,
  version VARCHAR(64) NOT NULL,
  name VARCHAR(256) NOT NULL,
  config_json CLOB NOT NULL DEFAULT '{}',
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_templates PRIMARY KEY (id, version),
  CONSTRAINT chk_templates_config CHECK (JSON_VALID(config_json) = 1)
);

CREATE TABLE users (
  id VARCHAR(128) NOT NULL,
  display_name VARCHAR(256) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT chk_users_status CHECK (status IN ('active', 'disabled'))
);

CREATE TABLE projects (
  id VARCHAR(128) NOT NULL,
  name VARCHAR(256) NOT NULL,
  template_id VARCHAR(128) NOT NULL,
  template_version VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  theme_json CLOB NOT NULL DEFAULT '{}',
  terminology_json CLOB NOT NULL DEFAULT '{}',
  published_version_id INTEGER,
  draft_version_id INTEGER,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  archived_at VARCHAR(40),
  CONSTRAINT pk_projects PRIMARY KEY (id),
  CONSTRAINT chk_projects_status CHECK (status IN ('active', 'archived')),
  CONSTRAINT chk_projects_theme CHECK (JSON_VALID(theme_json) = 1),
  CONSTRAINT chk_projects_term CHECK (JSON_VALID(terminology_json) = 1),
  CONSTRAINT fk_projects_tmpl FOREIGN KEY (template_id, template_version) REFERENCES templates(id, version)
);

CREATE TABLE project_members (
  project_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  role VARCHAR(40) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_project_members PRIMARY KEY (project_id, user_id),
  CONSTRAINT chk_pm_role CHECK (role IN ('platform_admin', 'project_admin', 'project_editor', 'viewer')),
  CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE project_versions (
  id INTEGER IDENTITY(1,1),
  project_id VARCHAR(128) NOT NULL,
  layer VARCHAR(20) NOT NULL,
  version_label VARCHAR(128) NOT NULL,
  source_checksum VARCHAR(128) NOT NULL DEFAULT '',
  metadata_json CLOB NOT NULL DEFAULT '{}',
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_project_versions PRIMARY KEY (id),
  CONSTRAINT chk_pv_layer CHECK (layer IN ('published', 'draft')),
  CONSTRAINT chk_pv_meta CHECK (JSON_VALID(metadata_json) = 1),
  CONSTRAINT fk_pv_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT uq_pv_proj_layer_ver UNIQUE (project_id, layer, version_label),
  CONSTRAINT uq_pv_proj_id UNIQUE (project_id, id)
);

CREATE TABLE project_modules (
  version_id INTEGER NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  module_type VARCHAR(64) NOT NULL,
  position INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  data_json CLOB NOT NULL DEFAULT '{}',
  CONSTRAINT pk_project_modules PRIMARY KEY (version_id, external_id),
  CONSTRAINT chk_pm_enabled CHECK (enabled IN (0, 1)),
  CONSTRAINT chk_pm_data CHECK (JSON_VALID(data_json) = 1),
  CONSTRAINT fk_pm_version FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
);

CREATE TABLE project_units (
  version_id INTEGER NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  position INTEGER NOT NULL,
  name VARCHAR(256) NOT NULL,
  data_json CLOB NOT NULL DEFAULT '{}',
  CONSTRAINT pk_project_units PRIMARY KEY (version_id, external_id),
  CONSTRAINT uq_pu_pos UNIQUE (version_id, position),
  CONSTRAINT chk_pu_data CHECK (JSON_VALID(data_json) = 1),
  CONSTRAINT fk_pu_version FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
);

CREATE TABLE project_stages (
  version_id INTEGER NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  position INTEGER NOT NULL,
  title VARCHAR(256) NOT NULL,
  date_label VARCHAR(128) NOT NULL DEFAULT '',
  data_json CLOB NOT NULL DEFAULT '{}',
  CONSTRAINT pk_project_stages PRIMARY KEY (version_id, external_id),
  CONSTRAINT uq_ps_pos UNIQUE (version_id, position),
  CONSTRAINT chk_ps_data CHECK (JSON_VALID(data_json) = 1),
  CONSTRAINT fk_ps_version FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
);

CREATE TABLE project_closures (
  version_id INTEGER NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  position INTEGER NOT NULL,
  title VARCHAR(256) NOT NULL,
  date_label VARCHAR(128) NOT NULL DEFAULT '',
  data_json CLOB NOT NULL DEFAULT '{}',
  CONSTRAINT pk_project_closures PRIMARY KEY (version_id, external_id),
  CONSTRAINT uq_pc_pos UNIQUE (version_id, position),
  CONSTRAINT chk_pc_data CHECK (JSON_VALID(data_json) = 1),
  CONSTRAINT fk_pc_version FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
);

CREATE TABLE project_tasks (
  version_id INTEGER NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  unit_external_id VARCHAR(128) NOT NULL,
  parent_external_id VARCHAR(128),
  position INTEGER NOT NULL,
  title VARCHAR(512) NOT NULL,
  start_date VARCHAR(40) NOT NULL DEFAULT '',
  end_date VARCHAR(40) NOT NULL DEFAULT '',
  progress DOUBLE PRECISION,
  data_json CLOB NOT NULL DEFAULT '{}',
  CONSTRAINT pk_project_tasks PRIMARY KEY (version_id, external_id),
  CONSTRAINT uq_pt_pos UNIQUE (version_id, position),
  CONSTRAINT chk_pt_progress CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100)),
  CONSTRAINT chk_pt_data CHECK (JSON_VALID(data_json) = 1),
  CONSTRAINT fk_pt_version FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_pt_unit FOREIGN KEY (version_id, unit_external_id) REFERENCES project_units(version_id, external_id),
  CONSTRAINT fk_pt_parent FOREIGN KEY (version_id, parent_external_id) REFERENCES project_tasks(version_id, external_id) DEFERRABLE
);

CREATE TABLE task_links (
  version_id INTEGER NOT NULL,
  task_external_id VARCHAR(128) NOT NULL,
  depends_on_external_id VARCHAR(128) NOT NULL,
  relation_type VARCHAR(40) NOT NULL DEFAULT 'depends_on',
  position INTEGER NOT NULL,
  CONSTRAINT pk_task_links PRIMARY KEY (version_id, task_external_id, depends_on_external_id, relation_type),
  CONSTRAINT chk_tl_rel CHECK (relation_type = 'depends_on'),
  CONSTRAINT fk_tl_task FOREIGN KEY (version_id, task_external_id) REFERENCES project_tasks(version_id, external_id) ON DELETE CASCADE,
  CONSTRAINT fk_tl_dep FOREIGN KEY (version_id, depends_on_external_id) REFERENCES project_tasks(version_id, external_id)
);

CREATE TABLE project_workstreams (
  version_id INTEGER NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  position INTEGER NOT NULL,
  title VARCHAR(256) NOT NULL,
  data_json CLOB NOT NULL DEFAULT '{}',
  CONSTRAINT pk_project_workstreams PRIMARY KEY (version_id, external_id),
  CONSTRAINT uq_pw_pos UNIQUE (version_id, position),
  CONSTRAINT chk_pw_data CHECK (JSON_VALID(data_json) = 1),
  CONSTRAINT fk_pw_version FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
);

CREATE TABLE workstream_tasks (
  version_id INTEGER NOT NULL,
  workstream_external_id VARCHAR(128) NOT NULL,
  task_external_id VARCHAR(128) NOT NULL,
  position INTEGER NOT NULL,
  CONSTRAINT pk_workstream_tasks PRIMARY KEY (version_id, workstream_external_id, task_external_id),
  CONSTRAINT fk_wt_ws FOREIGN KEY (version_id, workstream_external_id) REFERENCES project_workstreams(version_id, external_id) ON DELETE CASCADE,
  CONSTRAINT fk_wt_task FOREIGN KEY (version_id, task_external_id) REFERENCES project_tasks(version_id, external_id)
);

CREATE TABLE change_proposals (
  id VARCHAR(128) NOT NULL,
  project_id VARCHAR(128) NOT NULL,
  base_version_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  schema_version VARCHAR(64) NOT NULL,
  payload_json CLOB NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_change_proposals PRIMARY KEY (id),
  CONSTRAINT chk_cp_status CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  CONSTRAINT chk_cp_payload CHECK (JSON_VALID(payload_json) = 1),
  CONSTRAINT fk_cp_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_base FOREIGN KEY (base_version_id) REFERENCES project_versions(id)
);

CREATE INDEX idx_project_versions_project ON project_versions(project_id, layer, id);
CREATE INDEX idx_project_tasks_unit ON project_tasks(version_id, unit_external_id, position);
CREATE INDEX idx_task_links_target ON task_links(version_id, depends_on_external_id);
CREATE INDEX idx_change_proposals_project ON change_proposals(project_id, status, created_at);

-- 触发器: 版本指针校验
CREATE TRIGGER validate_published_version_pointer
BEFORE UPDATE OF published_version_id ON projects
REFERENCING NEW AS NEW
WHEN NEW.published_version_id IS NOT NULL
BEGIN
  DECLARE v_count INTEGER;
  SELECT COUNT(*) INTO v_count FROM project_versions
  WHERE id = NEW.published_version_id AND project_id = NEW.id AND layer = 'published';
  IF v_count = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'published version must belong to project and published layer';
  END IF;
END;

CREATE TRIGGER validate_draft_version_pointer
BEFORE UPDATE OF draft_version_id ON projects
REFERENCING NEW AS NEW
WHEN NEW.draft_version_id IS NOT NULL
BEGIN
  DECLARE v_count INTEGER;
  SELECT COUNT(*) INTO v_count FROM project_versions
  WHERE id = NEW.draft_version_id AND project_id = NEW.id AND layer = 'draft';
  IF v_count = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'draft version must belong to project and draft layer';
  END IF;
END;
