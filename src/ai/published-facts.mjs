export function readPublishedFacts(database, projectId) {
  const project = database.prepare(`SELECT p.name, p.published_version_id AS versionId, v.version_label AS version
    FROM projects p JOIN project_versions v ON v.id = p.published_version_id AND v.project_id = p.id AND v.layer = 'published'
    WHERE p.id = ?`).get(projectId);
  if (!project) return null;
  const units = database.prepare("SELECT name FROM project_units WHERE version_id = ? ORDER BY position LIMIT 100").all(project.versionId).map(row => row.name);
  const stages = database.prepare("SELECT title, date_label AS date FROM project_stages WHERE version_id = ? ORDER BY position LIMIT 100").all(project.versionId);
  const tasks = database.prepare("SELECT title, start_date AS startDate, end_date AS endDate, progress FROM project_tasks WHERE version_id = ? ORDER BY position LIMIT 300").all(project.versionId);
  return { projectName: project.name, publishedVersion: project.version, units, stages, tasks };
}
