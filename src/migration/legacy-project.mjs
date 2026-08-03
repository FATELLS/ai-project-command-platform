import { createHash } from "node:crypto";
import { withTransaction } from "../db/database.mjs";
import { insertOrIgnore } from "../db/sql-dialect.mjs";
import { validateLegacyFixture } from "../domain/project-validator.mjs";
import { createProjectRepository } from "../repositories/project-repository.mjs";
import { resolveTemplate, templateConfigJson } from "../templates/catalog.mjs";

const projectIdPattern = /^[a-z0-9][a-z0-9._-]*$/;
const entityArrays = new Set(["groups", "stages", "closures", "tasks", "companyWorkstreams"]);

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

export function semanticallyEqual(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function without(source, keys) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.has(key)));
}

function insertVersionGraph(database, projectId, layer, snapshot, sourceChecksum, now, template) {
  const metadata = without(snapshot, entityArrays);
  const versionResult = database.prepare(`
    INSERT INTO project_versions (project_id, layer, version_label, source_checksum, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(projectId, layer, snapshot.version, sourceChecksum, JSON.stringify(metadata), now);
  const versionId = Number(versionResult.lastInsertRowid);

  const insertModule = database.prepare(`
    INSERT INTO project_modules (version_id, external_id, module_type, position, enabled, data_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  template.modules.forEach(module => insertModule.run(
    versionId,
    module.type,
    module.type,
    module.position,
    module.enabled ? 1 : 0,
    JSON.stringify({ schemaVersion: module.schemaVersion, viewVariant: module.viewVariant })
  ));
  const insertCard = database.prepare(`
    INSERT INTO project_cards (
      version_id, external_id, element_type, position, title, owner, state, objective,
      start_date, end_date, progress, health, unit_id, parent_id, depends_on,
      card_attrs, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const addCard = (type, position, item, data = {}) => insertCard.run(
    versionId, item.id, type, position, item.title ?? item.name,
    data.owner ?? "", data.state ?? data.status ?? "", data.objective ?? "",
    item.date ?? item.startDate ?? "", item.endDate ?? data.endDate ?? "",
    item.progress ?? null, data.health ?? "", item.groupId ?? "", item.parentId || null,
    JSON.stringify(item.dependsOn ?? []), JSON.stringify(data), now, now
  );

  snapshot.groups.forEach((item, position) => addCard(
    "unit", position, item, without(item, new Set(["id", "name"]))
  ));
  snapshot.stages.forEach((item, position) => addCard(
    "stage", position, item, without(item, new Set(["id", "title", "date"]))
  ));
  (snapshot.closures ?? []).forEach((item, position) => addCard(
    "outcome", position, item, without(item, new Set(["id", "title", "date"]))
  ));
  snapshot.tasks.forEach((item, position) => addCard(
    "task", position, item,
    without(item, new Set(["id", "groupId", "parentId", "dependsOn", "title", "startDate", "endDate", "progress"]))
  ));
  (snapshot.companyWorkstreams ?? []).forEach((item, position) => addCard(
    "workstream", position, item,
    { ...without(item, new Set(["id", "title", "taskIds"])), members: item.taskIds ?? [] }
  ));

  const insertLink = database.prepare(`
    INSERT INTO project_card_links (version_id, card_external_id, depends_on_external_id, position)
    VALUES (?, ?, ?, ?)
  `);
  snapshot.tasks.forEach(item => (item.dependsOn ?? []).forEach((dependency, position) => {
    insertLink.run(versionId, item.id, dependency, position);
  }));
  return versionId;
}

export function importLegacyProject(database, fixture, options = {}) {
  const projectId = options.projectId ?? "xugu-agentic-group";
  if (!projectIdPattern.test(projectId)) throw new Error("Project ID must be a stable lowercase ID");
  const validation = validateLegacyFixture(fixture);
  const repository = createProjectRepository(database);
  const existing = repository.getProject(projectId);
  if (existing) {
    const exported = repository.getLegacyFixture(projectId);
    if (exported && semanticallyEqual(exported, fixture)) {
      return { imported: false, projectId, validation };
    }
    throw new Error(`Project ${projectId} already exists with different content`);
  }

  return withTransaction(database, () => {
    const now = options.now ?? new Date().toISOString();
    const templateId = options.templateId ?? "campaign-map-v1";
    const templateVersion = options.templateVersion ?? "1.0.0";
    const template = resolveTemplate(templateId, templateVersion);
    const projectName = options.name ?? fixture.published.title;
    insertOrIgnore(database, "templates",
      ["id", "version", "name", "config_json", "created_at"],
      [template.id, template.version, template.name, templateConfigJson(template), now],
      ["id", "version"]
    );
    const storedTemplate = database.prepare(
      "SELECT name, config_json AS configJson FROM templates WHERE id = ? AND version = ?"
    ).get(template.id, template.version);
    if (storedTemplate.name !== template.name || !semanticallyEqual(JSON.parse(storedTemplate.configJson), template)) {
      throw new Error(`Template ${template.id}@${template.version} differs from the immutable catalog`);
    }
    database.prepare(`
      INSERT INTO projects (
        id, name, template_id, template_version, status, theme_json, terminology_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).run(
      projectId, projectName, templateId, templateVersion,
      JSON.stringify(options.theme ?? template.theme),
      JSON.stringify(options.terminology ?? template.terminology),
      now, now
    );
    const publishedVersionId = insertVersionGraph(database, projectId, "published", fixture.published, sha256(fixture.published), now, template);
    const draftVersionId = insertVersionGraph(database, projectId, "draft", fixture.draft, sha256(fixture.draft), now, template);
    database.prepare(`
      UPDATE projects SET published_version_id = ?, draft_version_id = ?, updated_at = ? WHERE id = ?
    `).run(publishedVersionId, draftVersionId, now, projectId);
    return {
      imported: true,
      projectId,
      publishedVersionId,
      draftVersionId,
      validation
    };
  });
}

export function exportLegacyProject(database, projectId) {
  const fixture = createProjectRepository(database).getLegacyFixture(projectId);
  if (!fixture) throw new Error(`Project ${projectId} was not found or has incomplete version pointers`);
  return fixture;
}
