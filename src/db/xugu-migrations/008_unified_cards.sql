-- ============================================================
-- 虚谷版本 — 统一卡片存储 (Table + JSON 混合模式)
-- ============================================================
-- 设计原则:
--   P0 必备字段（所有卡片都有，需要 WHERE/ORDER BY）提为表列
--   非公共但项目相关的字段（P1/P2 + 类型特有）追加到 card_attrs JSON
--
-- 替代的旧表（数据迁移后废弃）:
--   project_tasks      -> project_cards (element_type='task')
--   project_units      -> project_cards (element_type='unit')
--   project_stages     -> project_cards (element_type='stage')
--   project_closures   -> project_cards (element_type='outcome')
--   project_workstreams-> project_cards (element_type='workstream')
--   project_risks      -> project_cards (element_type='risk')
--   project_metrics    -> project_cards (element_type='metric')
--   task_links         -> project_card_links (保留，关系独立于卡片属性)
--   workstream_tasks  -> 通过 card_attrs.members[] 实现
-- ============================================================

CREATE TABLE project_cards (
  -- 主键与定位
  version_id INTEGER NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  element_type VARCHAR(30) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,

  -- P0 公共必备字段（提为列，支持 WHERE / ORDER BY / INDEX）
  title VARCHAR(512) NOT NULL DEFAULT '',
  owner VARCHAR(256) NOT NULL DEFAULT '',
  state VARCHAR(20) NOT NULL DEFAULT '',
  objective CLOB NOT NULL DEFAULT '',
  start_date VARCHAR(40) NOT NULL DEFAULT '',
  end_date VARCHAR(40) NOT NULL DEFAULT '',
  progress SMALLINT,
  health VARCHAR(20) NOT NULL DEFAULT '',

  -- 结构关系（需要 FK 约束和图查询，提为列）
  unit_id VARCHAR(128) NOT NULL DEFAULT '',
  parent_id VARCHAR(128),
  depends_on CLOB NOT NULL DEFAULT '[]',

  -- 非公共属性（P1/P2 + 类型特有，追加到 JSON）
  card_attrs JSON NOT NULL DEFAULT '{}',

  -- 时间戳
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,

  CONSTRAINT pk_project_cards PRIMARY KEY (version_id, external_id),
  CONSTRAINT uq_pc_pos UNIQUE (version_id, element_type, position),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_pc_etype CHECK (element_type IN (
  --   'task', 'unit', 'stage', 'outcome', 'workstream', 'risk', 'metric'
  -- )),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_pc_progress CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100)),
  CONSTRAINT fk_pc_version FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
);

-- 函数索引：加速 JSON 内部字段查询
CREATE INDEX idx_pc_owner ON project_cards(version_id, owner);
CREATE INDEX idx_pc_state ON project_cards(version_id, element_type, state);
CREATE INDEX idx_pc_type_pos ON project_cards(version_id, element_type, position);
CREATE INDEX idx_pc_unit ON project_cards(version_id, unit_id);
CREATE INDEX idx_pc_parent ON project_cards(version_id, parent_id);
CREATE INDEX idx_pc_dates ON project_cards(version_id, start_date, end_date);

-- 卡片间链接关系（替代 task_links，支持所有卡片类型的依赖/引用关系）
CREATE TABLE project_card_links (
  version_id INTEGER NOT NULL,
  card_external_id VARCHAR(128) NOT NULL,
  depends_on_external_id VARCHAR(128) NOT NULL,
  relation_type VARCHAR(40) NOT NULL DEFAULT 'depends_on',
  position INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT pk_project_card_links PRIMARY KEY (version_id, card_external_id, depends_on_external_id, relation_type),
  -- [SKIPPED: 虚谷 CHECK 约束兼容性问题，校验在应用层]
  -- CONSTRAINT chk_pcl_rel CHECK (relation_type IN ('depends_on', 'blocks', 'relates_to', 'completes')),
  CONSTRAINT fk_pcl_card FOREIGN KEY (version_id, card_external_id) REFERENCES project_cards(version_id, external_id) ON DELETE CASCADE,
  CONSTRAINT fk_pcl_dep FOREIGN KEY (version_id, depends_on_external_id) REFERENCES project_cards(version_id, external_id)
);

CREATE INDEX idx_pcl_card ON project_card_links(version_id, card_external_id);
CREATE INDEX idx_pcl_dep ON project_card_links(version_id, depends_on_external_id);

-- ============================================================
-- 数据迁移：从旧分表导入到 project_cards
-- ============================================================

-- 1. 迁移 project_tasks -> project_cards (element_type='task')
INSERT INTO project_cards (
  version_id, external_id, element_type, position,
  title, owner, state, objective, start_date, end_date, progress, health,
  unit_id, parent_id, depends_on, card_attrs,
  created_at, updated_at
)
SELECT
  t.version_id, t.external_id, 'task', t.position,
  t.title,
  COALESCE(JSON_VALUE(t.data_json, '$.owner'), ''),
  COALESCE(JSON_VALUE(t.data_json, '$.state'), ''),
  COALESCE(JSON_VALUE(t.data_json, '$.objective'), ''),
  t.start_date, t.end_date,
  CAST(t.progress AS SMALLINT),
  COALESCE(JSON_VALUE(t.data_json, '$.health'), ''),
  t.unit_external_id,
  t.parent_external_id,
  COALESCE((SELECT JSON_ARRAYAGG(l.depends_on_external_id) FROM task_links l
           WHERE l.version_id = t.version_id AND l.task_external_id = t.external_id
           ORDER BY l.position), JSON_ARRAY()),
  JSON_MERGE_PATCH('{}', t.data_json),
  (SELECT created_at FROM project_versions WHERE id = t.version_id),
  (SELECT created_at FROM project_versions WHERE id = t.version_id)
FROM project_tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM project_cards pc
  WHERE pc.version_id = t.version_id AND pc.external_id = t.external_id
);

-- 2. 迁移 project_units -> project_cards (element_type='unit')
INSERT INTO project_cards (
  version_id, external_id, element_type, position,
  title, owner, state, objective, card_attrs,
  created_at, updated_at
)
SELECT
  u.version_id, u.external_id, 'unit', u.position,
  u.name,
  COALESCE(JSON_VALUE(u.data_json, '$.owner'), ''),
  COALESCE(JSON_VALUE(u.data_json, '$.status'), ''),
  COALESCE(JSON_VALUE(u.data_json, '$.objective'), ''),
  JSON_MERGE_PATCH('{}', u.data_json),
  (SELECT created_at FROM project_versions WHERE id = u.version_id),
  (SELECT created_at FROM project_versions WHERE id = u.version_id)
FROM project_units u
WHERE NOT EXISTS (
  SELECT 1 FROM project_cards pc
  WHERE pc.version_id = u.version_id AND pc.external_id = u.external_id
);

-- 3. 迁移 project_stages -> project_cards (element_type='stage')
INSERT INTO project_cards (
  version_id, external_id, element_type, position,
  title, state, start_date, end_date, card_attrs,
  created_at, updated_at
)
SELECT
  s.version_id, s.external_id, 'stage', s.position,
  s.title,
  COALESCE(JSON_VALUE(s.data_json, '$.state'), ''),
  COALESCE(JSON_VALUE(s.data_json, '$.startDate'), ''),
  COALESCE(JSON_VALUE(s.data_json, '$.endDate'), ''),
  JSON_MERGE_PATCH('{"dateLabel": "", "description": "", "expectedOutput": ""}', s.data_json),
  (SELECT created_at FROM project_versions WHERE id = s.version_id),
  (SELECT created_at FROM project_versions WHERE id = s.version_id)
FROM project_stages s
WHERE NOT EXISTS (
  SELECT 1 FROM project_cards pc
  WHERE pc.version_id = s.version_id AND pc.external_id = s.external_id
);

-- 4. 迁移 project_closures -> project_cards (element_type='outcome')
INSERT INTO project_cards (
  version_id, external_id, element_type, position,
  title, state, card_attrs,
  created_at, updated_at
)
SELECT
  c.version_id, c.external_id, 'outcome', c.position,
  c.title,
  COALESCE(JSON_VALUE(c.data_json, '$.state'), ''),
  JSON_MERGE_PATCH('{"dateLabel": "", "description": "", "result": "", "source": ""}', c.data_json),
  (SELECT created_at FROM project_versions WHERE id = c.version_id),
  (SELECT created_at FROM project_versions WHERE id = c.version_id)
FROM project_closures c
WHERE NOT EXISTS (
  SELECT 1 FROM project_cards pc
  WHERE pc.version_id = c.version_id AND pc.external_id = c.external_id
);

-- 5. 迁移 project_workstreams -> project_cards (element_type='workstream')
INSERT INTO project_cards (
  version_id, external_id, element_type, position,
  title, card_attrs,
  created_at, updated_at
)
SELECT
  w.version_id, w.external_id, 'workstream', w.position,
  w.title,
  JSON_MERGE_PATCH(
    JSON_OBJECT('members',
      COALESCE((SELECT JSON_ARRAYAGG(wt.task_external_id) FROM workstream_tasks wt
               WHERE wt.version_id = w.version_id AND wt.workstream_external_id = w.external_id
               ORDER BY wt.position), JSON_ARRAY())
    ),
    w.data_json
  ),
  (SELECT created_at FROM project_versions WHERE id = w.version_id),
  (SELECT created_at FROM project_versions WHERE id = w.version_id)
FROM project_workstreams w
WHERE NOT EXISTS (
  SELECT 1 FROM project_cards pc
  WHERE pc.version_id = w.version_id AND pc.external_id = w.external_id
);

-- 6. 迁移 project_risks -> project_cards (element_type='risk')
INSERT INTO project_cards (
  version_id, external_id, element_type, position,
  title, owner, state, end_date, card_attrs,
  created_at, updated_at
)
SELECT
  r.version_id, r.external_id, 'risk', r.position,
  r.title, r.owner, r.status, r.due_date,
  JSON_MERGE_PATCH(
    JSON_OBJECT(
      'severity', r.severity,
      'mitigation', r.mitigation,
      'source', r.source
    ),
    r.data_json
  ),
  (SELECT created_at FROM project_versions WHERE id = r.version_id),
  (SELECT created_at FROM project_versions WHERE id = r.version_id)
FROM project_risks r
WHERE NOT EXISTS (
  SELECT 1 FROM project_cards pc
  WHERE pc.version_id = r.version_id AND pc.external_id = r.external_id
);

-- 7. 迁移 project_metrics -> project_cards (element_type='metric')
INSERT INTO project_cards (
  version_id, external_id, element_type, position,
  title, state, start_date, card_attrs,
  created_at, updated_at
)
SELECT
  m.version_id, m.external_id, 'metric', m.position,
  m.name, m.status, m.as_of,
  JSON_MERGE_PATCH(
    JSON_OBJECT(
      'value', m.value_json,
      'unit', m.unit,
      'target', m.target_json,
      'source', m.source
    ),
    m.data_json
  ),
  (SELECT created_at FROM project_versions WHERE id = m.version_id),
  (SELECT created_at FROM project_versions WHERE id = m.version_id)
FROM project_metrics m
WHERE NOT EXISTS (
  SELECT 1 FROM project_cards pc
  WHERE pc.version_id = m.version_id AND pc.external_id = m.external_id
);

-- 8. 迁移 task_links -> project_card_links
INSERT INTO project_card_links (version_id, card_external_id, depends_on_external_id, relation_type, position)
SELECT version_id, task_external_id, depends_on_external_id, relation_type, position
FROM task_links
WHERE NOT EXISTS (
  SELECT 1 FROM project_card_links pcl
  WHERE pcl.version_id = task_links.version_id
    AND pcl.card_external_id = task_links.task_external_id
    AND pcl.depends_on_external_id = task_links.depends_on_external_id
);

-- ============================================================
-- 更新 module_type 枚举：旧表名称不再使用，但保持兼容
-- 不删除旧表（保留作为回滚安全网），只新增 project_cards
-- ============================================================
