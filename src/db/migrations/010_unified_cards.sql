-- ============================================================
-- SQLite 版本 — 统一卡片存储 (Table + JSON 混合模式)
-- 与虚谷 008_unified_cards.sql 保持一致
-- ============================================================
-- P0 必备字段提为表列，非公共属性追加到 card_attrs JSON
-- ============================================================

CREATE TABLE project_cards (
  version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  element_type TEXT NOT NULL CHECK (element_type IN (
    'task', 'unit', 'stage', 'outcome', 'workstream', 'risk', 'metric'
  )),
  position INTEGER NOT NULL DEFAULT 0,

  title TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  progress INTEGER,
  health TEXT NOT NULL DEFAULT '',

  unit_id TEXT NOT NULL DEFAULT '',
  parent_id TEXT,
  depends_on TEXT NOT NULL DEFAULT '[]',

  card_attrs TEXT NOT NULL DEFAULT '{}',

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  PRIMARY KEY (version_id, external_id),
  UNIQUE (version_id, element_type, position),
  CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100)),
  CHECK (json_valid(card_attrs)),
  CHECK (json_valid(depends_on))
) STRICT;

CREATE INDEX idx_pc_owner ON project_cards(version_id, owner);
CREATE INDEX idx_pc_state ON project_cards(element_type, state);
CREATE INDEX idx_pc_type_pos ON project_cards(version_id, element_type, position);
CREATE INDEX idx_pc_unit ON project_cards(version_id, unit_id);
CREATE INDEX idx_pc_parent ON project_cards(version_id, parent_id);
CREATE INDEX idx_pc_dates ON project_cards(version_id, start_date, end_date);

CREATE TABLE project_card_links (
  version_id INTEGER NOT NULL,
  card_external_id TEXT NOT NULL,
  depends_on_external_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'depends_on',
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (version_id, card_external_id, depends_on_external_id, relation_type),
  CHECK (relation_type IN ('depends_on', 'blocks', 'relates_to', 'completes')),
  FOREIGN KEY (version_id, card_external_id) REFERENCES project_cards(version_id, external_id) ON DELETE CASCADE,
  FOREIGN KEY (version_id, depends_on_external_id) REFERENCES project_cards(version_id, external_id)
) STRICT;

CREATE INDEX idx_pcl_card ON project_card_links(version_id, card_external_id);
CREATE INDEX idx_pcl_dep ON project_card_links(version_id, depends_on_external_id);

-- ============================================================
-- 数据迁移
-- ============================================================

-- 1. project_tasks -> project_cards (element_type='task')
INSERT OR IGNORE INTO project_cards (
  version_id, external_id, element_type, position,
  title, owner, state, objective, start_date, end_date, progress, health,
  unit_id, parent_id, depends_on, card_attrs,
  created_at, updated_at
)
SELECT
  t.version_id, t.external_id, 'task', t.position,
  t.title,
  COALESCE(json_extract(t.data_json, '$.owner'), ''),
  COALESCE(json_extract(t.data_json, '$.state'), ''),
  COALESCE(json_extract(t.data_json, '$.objective'), ''),
  t.start_date, t.end_date,
  CAST(t.progress AS INTEGER),
  COALESCE(json_extract(t.data_json, '$.health'), ''),
  t.unit_external_id,
  t.parent_external_id,
  COALESCE((
    SELECT json_group_array(l.depends_on_external_id)
    FROM task_links l
    WHERE l.version_id = t.version_id AND l.task_external_id = t.external_id
    ORDER BY l.position
  ), '[]'),
  t.data_json,
  (SELECT created_at FROM project_versions WHERE id = t.version_id),
  (SELECT created_at FROM project_versions WHERE id = t.version_id)
FROM project_tasks t;

-- 2. project_units -> project_cards (element_type='unit')
INSERT OR IGNORE INTO project_cards (
  version_id, external_id, element_type, position,
  title, owner, state, objective, card_attrs,
  created_at, updated_at
)
SELECT
  u.version_id, u.external_id, 'unit', u.position,
  u.name,
  COALESCE(json_extract(u.data_json, '$.owner'), ''),
  COALESCE(json_extract(u.data_json, '$.status'), ''),
  COALESCE(json_extract(u.data_json, '$.objective'), ''),
  u.data_json,
  (SELECT created_at FROM project_versions WHERE id = u.version_id),
  (SELECT created_at FROM project_versions WHERE id = u.version_id)
FROM project_units u;

-- 3. project_stages -> project_cards (element_type='stage')
INSERT OR IGNORE INTO project_cards (
  version_id, external_id, element_type, position,
  title, state, start_date, end_date, card_attrs,
  created_at, updated_at
)
SELECT
  s.version_id, s.external_id, 'stage', s.position,
  s.title,
  COALESCE(json_extract(s.data_json, '$.state'), ''),
  COALESCE(json_extract(s.data_json, '$.startDate'), ''),
  COALESCE(json_extract(s.data_json, '$.endDate'), ''),
  s.data_json,
  (SELECT created_at FROM project_versions WHERE id = s.version_id),
  (SELECT created_at FROM project_versions WHERE id = s.version_id)
FROM project_stages s;

-- 4. project_closures -> project_cards (element_type='outcome')
INSERT OR IGNORE INTO project_cards (
  version_id, external_id, element_type, position,
  title, state, card_attrs,
  created_at, updated_at
)
SELECT
  c.version_id, c.external_id, 'outcome', c.position,
  c.title,
  COALESCE(json_extract(c.data_json, '$.state'), ''),
  c.data_json,
  (SELECT created_at FROM project_versions WHERE id = c.version_id),
  (SELECT created_at FROM project_versions WHERE id = c.version_id)
FROM project_closures c;

-- 5. project_workstreams -> project_cards (element_type='workstream')
INSERT OR IGNORE INTO project_cards (
  version_id, external_id, element_type, position,
  title, card_attrs,
  created_at, updated_at
)
SELECT
  w.version_id, w.external_id, 'workstream', w.position,
  w.title,
  json_patch(w.data_json, json_object(
    'members',
    COALESCE((
      SELECT json_group_array(wt.task_external_id)
      FROM workstream_tasks wt
      WHERE wt.version_id = w.version_id AND wt.workstream_external_id = w.external_id
      ORDER BY wt.position
    ), '[]')
  )),
  (SELECT created_at FROM project_versions WHERE id = w.version_id),
  (SELECT created_at FROM project_versions WHERE id = w.version_id)
FROM project_workstreams w;

-- 6. project_risks -> project_cards (element_type='risk')
INSERT OR IGNORE INTO project_cards (
  version_id, external_id, element_type, position,
  title, owner, state, end_date, card_attrs,
  created_at, updated_at
)
SELECT
  r.version_id, r.external_id, 'risk', r.position,
  r.title, r.owner, r.status, r.due_date,
  json_patch(json_object(
    'severity', r.severity,
    'mitigation', r.mitigation,
    'source', r.source
  ), r.data_json),
  (SELECT created_at FROM project_versions WHERE id = r.version_id),
  (SELECT created_at FROM project_versions WHERE id = r.version_id)
FROM project_risks r;

-- 7. project_metrics -> project_cards (element_type='metric')
INSERT OR IGNORE INTO project_cards (
  version_id, external_id, element_type, position,
  title, state, start_date, card_attrs,
  created_at, updated_at
)
SELECT
  m.version_id, m.external_id, 'metric', m.position,
  m.name, m.status, m.as_of,
  json_patch(json_object(
    'value', m.value_json,
    'unit', m.unit,
    'target', m.target_json,
    'source', m.source
  ), m.data_json),
  (SELECT created_at FROM project_versions WHERE id = m.version_id),
  (SELECT created_at FROM project_versions WHERE id = m.version_id)
FROM project_metrics m;

-- 8. task_links -> project_card_links
INSERT OR IGNORE INTO project_card_links (version_id, card_external_id, depends_on_external_id, relation_type, position)
SELECT version_id, task_external_id, depends_on_external_id, relation_type, position
FROM task_links;
