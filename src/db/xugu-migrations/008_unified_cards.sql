-- Unified project element storage for every project version.

CREATE TABLE project_cards (
  version_id INTEGER NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  element_type VARCHAR(30) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  title VARCHAR(512) NOT NULL DEFAULT '',
  owner VARCHAR(256) NOT NULL DEFAULT '',
  state VARCHAR(20) NOT NULL DEFAULT '',
  objective CLOB NOT NULL DEFAULT '',
  start_date VARCHAR(40) NOT NULL DEFAULT '',
  end_date VARCHAR(40) NOT NULL DEFAULT '',
  progress SMALLINT,
  health VARCHAR(20) NOT NULL DEFAULT '',
  unit_id VARCHAR(128) NOT NULL DEFAULT '',
  parent_id VARCHAR(128),
  depends_on CLOB NOT NULL DEFAULT '[]',
  card_attrs JSON NOT NULL DEFAULT '{}',
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  CONSTRAINT pk_project_cards PRIMARY KEY (version_id, external_id),
  CONSTRAINT uq_pc_type_pos UNIQUE (version_id, element_type, position),
  CONSTRAINT fk_pc_version FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
);

CREATE INDEX idx_pc_owner ON project_cards(version_id, owner);
CREATE INDEX idx_pc_state ON project_cards(version_id, element_type, state);
CREATE INDEX idx_pc_type_pos ON project_cards(version_id, element_type, position);
CREATE INDEX idx_pc_unit ON project_cards(version_id, unit_id);
CREATE INDEX idx_pc_parent ON project_cards(version_id, parent_id);
CREATE INDEX idx_pc_dates ON project_cards(version_id, start_date, end_date);

CREATE TABLE project_card_links (
  version_id INTEGER NOT NULL,
  card_external_id VARCHAR(128) NOT NULL,
  depends_on_external_id VARCHAR(128) NOT NULL,
  relation_type VARCHAR(40) NOT NULL DEFAULT 'depends_on',
  position INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT pk_project_card_links PRIMARY KEY (version_id, card_external_id, depends_on_external_id, relation_type),
  CONSTRAINT fk_pcl_card FOREIGN KEY (version_id, card_external_id) REFERENCES project_cards(version_id, external_id) ON DELETE CASCADE,
  CONSTRAINT fk_pcl_dep FOREIGN KEY (version_id, depends_on_external_id) REFERENCES project_cards(version_id, external_id)
);

CREATE INDEX idx_pcl_card ON project_card_links(version_id, card_external_id);
CREATE INDEX idx_pcl_dep ON project_card_links(version_id, depends_on_external_id);
