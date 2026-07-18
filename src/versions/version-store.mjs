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
  for (const [table,columns] of [
    ["project_modules","external_id,module_type,position,enabled,data_json"],
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
  return target;
}

export function fingerprintGraph(graph) {
  return createHash("sha256").update(JSON.stringify(graph)).digest("hex");
}

export function setVersionChecksum(database, versionId, checksum) {
  database.prepare("UPDATE project_versions SET source_checksum=? WHERE id=?").run(checksum,versionId);
}
