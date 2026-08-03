-- ============================================================
-- XuguDB v1 platform foundation schema.
-- ============================================================

CREATE TABLE templates (
  id VARCHAR(128) NOT NULL,
  version VARCHAR(64) NOT NULL,
  name VARCHAR(256) NOT NULL,
  config_json CLOB NOT NULL DEFAULT '{}',
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_templates PRIMARY KEY (id, version)
);

CREATE TABLE users (
  id VARCHAR(128) NOT NULL,
  display_name VARCHAR(256) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_users PRIMARY KEY (id)
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_users_status CHECK (status IN ('active', 'disabled'))
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
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_projects_status CHECK (status IN ('active', 'archived')),
  CONSTRAINT fk_projects_tmpl FOREIGN KEY (template_id, template_version) REFERENCES templates(id, version)
);

CREATE TABLE project_members (
  project_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  role VARCHAR(40) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_project_members PRIMARY KEY (project_id, user_id),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_pm_role CHECK (role IN ('platform_admin', 'project_admin', 'project_editor', 'viewer')),
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
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_pv_layer CHECK (layer IN ('published', 'draft')),
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
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_pm_enabled CHECK (enabled IN (0, 1)),
  CONSTRAINT fk_pm_version FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
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
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_cp_status CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  CONSTRAINT fk_cp_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_base FOREIGN KEY (base_version_id) REFERENCES project_versions(id)
);

CREATE INDEX idx_project_versions_project ON project_versions(project_id, layer, id);
CREATE INDEX idx_change_proposals_project ON change_proposals(project_id, status, created_at);

-- 触发器: 版本指针校验
-- [SKIPPED: 虚谷 trigger 语法不兼容，校验逻辑在应用层处理]
-- CREATE TRIGGER validate_published_version_pointer
-- BEFORE UPDATE OF published_version_id ON projects
-- REFERENCING NEW AS NEW
-- WHEN NEW.published_version_id IS NOT NULL
-- BEGIN
--   DECLARE v_count INTEGER;
--   SELECT COUNT(*) INTO v_count FROM project_versions
--   WHERE id = NEW.published_version_id AND project_id = NEW.id AND layer = 'published';
--   IF v_count = 0 THEN
--     SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'published version must belong to project and published layer';
--   END IF;
-- END;  [orphaned from trigger commenting]

-- [SKIPPED: 虚谷 trigger 语法不兼容，校验逻辑在应用层处理]
-- CREATE TRIGGER validate_draft_version_pointer
-- BEFORE UPDATE OF draft_version_id ON projects
-- REFERENCING NEW AS NEW
-- WHEN NEW.draft_version_id IS NOT NULL
-- BEGIN
--   DECLARE v_count INTEGER;
--   SELECT COUNT(*) INTO v_count FROM project_versions
--   WHERE id = NEW.draft_version_id AND project_id = NEW.id AND layer = 'draft';
--   IF v_count = 0 THEN
--     SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'draft version must belong to project and draft layer';
--   END IF;
-- END;  [orphaned from trigger commenting]
