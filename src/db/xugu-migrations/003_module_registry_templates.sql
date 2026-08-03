-- Module registry tables. Template manifests are synchronized from the code catalog.

-- 数据迁移: 更新 module positions
UPDATE project_modules
SET position = CASE module_type
  WHEN 'overview' THEN 0 WHEN 'roadmap' THEN 1 WHEN 'units' THEN 2
  WHEN 'task-network' THEN 3 WHEN 'gantt' THEN 4 WHEN 'outcomes' THEN 5
  WHEN 'risks' THEN 6 WHEN 'metrics' THEN 7 WHEN 'materials' THEN 8
  ELSE position + 1000 END;

-- 数据迁移: 设置 module data_json 的 viewVariant
-- [SKIPPED: 虚谷不支持 JSON_OBJECT 函数，viewVariant 在应用层设置]
-- UPDATE project_modules SET data_json = JSON_OBJECT(...) WHERE ...

CREATE UNIQUE INDEX idx_project_modules_position ON project_modules(version_id, position);
