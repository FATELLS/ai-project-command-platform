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

  database.prepare("INSERT INTO project_modules (version_id,external_id,module_type,position,enabled,data_json) SELECT ?,external_id,module_type,position,enabled,data_json FROM project_modules WHERE version_id=?")
    .run(target, source.id);
  database.prepare("INSERT INTO project_cards (version_id,external_id,element_type,position,title,owner,state,objective,start_date,end_date,progress,health,unit_id,parent_id,depends_on,card_attrs,created_at,updated_at) SELECT ?,external_id,element_type,position,title,owner,state,objective,start_date,end_date,progress,health,unit_id,parent_id,depends_on,card_attrs,created_at,updated_at FROM project_cards WHERE version_id=?")
    .run(target, source.id);
  database.prepare("INSERT INTO project_card_links (version_id,card_external_id,depends_on_external_id,relation_type,position) SELECT ?,card_external_id,depends_on_external_id,relation_type,position FROM project_card_links WHERE version_id=?")
    .run(target, source.id);

  return target;
}

export function fingerprintGraph(graph) {
  return createHash("sha256").update(JSON.stringify(graph)).digest("hex");
}

export function setVersionChecksum(database, versionId, checksum) {
  database.prepare("UPDATE project_versions SET source_checksum=? WHERE id=?").run(checksum,versionId);
}
