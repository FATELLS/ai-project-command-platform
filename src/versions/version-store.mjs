import { createHash } from "node:crypto";

function parse(value, fallback = {}) { try { return JSON.parse(value); } catch { return fallback; } }

export function nextVersionLabel(database, projectId, layer, prefix = layer) {
  const count = database.prepare("SELECT count(*) AS count FROM project_versions WHERE project_id=? AND layer=?").get(projectId, layer).count;
  let sequence = count + 1;
  while (database.prepare("SELECT 1 FROM project_versions WHERE project_id=? AND layer=? AND version_label=?").get(projectId, layer, `${prefix}-${sequence}`)) sequence += 1;
  return `${prefix}-${sequence}`;
}

export function cloneVersion(database, input) {
  const source = database.prepare("SELECT * FROM project_versions WHERE project_id=? AND id=?").get(input.projectId, input.sourceVersionId);
  if (!source) throw new Error("Source project version was not found");
  const metadata = { ...parse(source.metadata_json), ...(input.metadata ?? {}) };
  const result = database.prepare(`INSERT INTO project_versions (project_id,layer,version_label,source_checksum,metadata_json,created_at) VALUES (?,?,?,?,?,?)`)
    .run(input.projectId,input.layer,input.versionLabel,source.source_checksum,JSON.stringify(metadata),input.createdAt);
  const target = Number(result.lastInsertRowid);

  // project_modules 总是存在
  database.exec(`INSERT INTO project_modules (version_id,external_id,module_type,position,enabled,data_json) SELECT ${target},external_id,module_type,position,enabled,data_json FROM project_modules WHERE version_id=${Number(source.id)}`);

  // 统一卡片表（如果存在）
  try {
    database.prepare("SELECT 1 FROM project_cards LIMIT 1").get();
    database.exec(`INSERT INTO project_cards (version_id,external_id,element_type,position,title,owner,state,objective,start_date,end_date,progress,health,unit_id,parent_id,depends_on,card_attrs,created_at,updated_at) SELECT ${target},external_id,element_type,position,title,owner,state,objective,start_date,end_date,progress,health,unit_id,parent_id,depends_on,card_attrs,created_at,updated_at FROM project_cards WHERE version_id=${Number(source.id)}`);
    database.exec(`INSERT INTO project_card_links (version_id,card_external_id,depends_on_external_id,relation_type,position) SELECT ${target},card_external_id,depends_on_external_id,relation_type,position FROM project_card_links WHERE version_id=${Number(source.id)}`);
  } catch { /* project_cards table not present — skip */ }

  // 旧表（兼容部分迁移测试——migration 010 之前的克隆场景）
  try {
    database.prepare("SELECT 1 FROM project_tasks LIMIT 1").get();
    for (const [table,columns] of [
      ["project_units","external_id,position,name,data_json"],
      ["project_stages","external_id,position,title,date_label,data_json"],
      ["project_closures","external_id,position,title,date_label,data_json"],
      ["project_tasks","external_id,unit_external_id,parent_external_id,position,title,start_date,end_date,progress,data_json"],
      ["task_links","task_external_id,depends_on_external_id,relation_type,position"],
      ["project_workstreams","external_id,position,title,data_json"],
      ["workstream_tasks","workstream_external_id,task_external_id,position"],
      ["project_risks","external_id,position,title,severity,status,owner,mitigation,due_date,source"],
      ["project_metrics","external_id,position,name,value_json,unit,status,as_of,target_json,source"]
    ]) database.exec(`INSERT INTO ${table} (version_id,${columns}) SELECT ${target},${columns} FROM ${table} WHERE version_id=${Number(source.id)}`);
  } catch { /* old tables not present — skip */ }

  return target;
}

export function fingerprintGraph(graph) {
  return createHash("sha256").update(JSON.stringify(graph)).digest("hex");
}

export function setVersionChecksum(database, versionId, checksum) {
  database.prepare("UPDATE project_versions SET source_checksum=? WHERE id=?").run(checksum,versionId);
}
