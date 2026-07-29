import { isXuguBackend } from "../db/database.mjs";

function decode(row) {
  return {
    id: row.externalId,
    materialId: row.materialId,
    extractionVersion: row.extractionVersion,
    ordinal: row.ordinal,
    kind: row.kind,
    location: JSON.parse(row.locationJson),
    text: row.text,
    summary: row.summary,
  };
}

export function createEvidenceService(database, options = {}) {
  const maxResults = options.maxResults ?? 8;
  const xugu = isXuguBackend();
  const access = audience => (audience === "editor" ? "editor" : "project_member");
  const columns = `b.external_id AS externalId, b.material_id AS materialId, b.extraction_version AS extractionVersion,
    b.ordinal, b.kind, b.location_json AS locationJson, b.text, b.summary`;

  function list({ projectId, materialId, requireQa = false, audience = "project_member" }) {
    const rows = database.prepare(`
      SELECT ${columns} FROM evidence_blocks b
      JOIN project_materials m ON m.project_id = b.project_id AND m.id = b.material_id
      LEFT JOIN material_qa_grants g ON g.project_id = b.project_id AND g.material_id = b.material_id
      WHERE b.project_id = ? AND b.material_id = ? AND m.status = 'ready'
        AND b.extraction_version = m.active_extraction_version
        AND (? = 0 OR (g.enabled = 1 AND (g.audience = 'project_members' OR (? = 'editor' AND g.audience = 'editors'))))
      ORDER BY b.ordinal LIMIT ?
    `).all(projectId, materialId, requireQa ? 1 : 0, access(audience), Math.min(options.maxListResults ?? 20_000, 20_000));
    return rows.map(decode);
  }

  function get({ projectId, evidenceId, requireQa = false, audience = "project_member" }) {
    const row = database.prepare(`
      SELECT ${columns} FROM evidence_blocks b
      JOIN project_materials m ON m.project_id = b.project_id AND m.id = b.material_id
      LEFT JOIN material_qa_grants g ON g.project_id = b.project_id AND g.material_id = b.material_id
      WHERE b.project_id = ? AND b.external_id = ? AND m.status = 'ready'
        AND b.extraction_version = m.active_extraction_version
        AND (? = 0 OR (g.enabled = 1 AND (g.audience = 'project_members' OR (? = 'editor' AND g.audience = 'editors'))))
    `).get(projectId, evidenceId, requireQa ? 1 : 0, access(audience));
    return row ? decode(row) : null;
  }

  function search({ projectId, query, audience = "project_member", limit = maxResults }) {
    const value = String(query ?? "").normalize("NFC").trim();
    if (!value) return [];
    const capped = Math.min(Math.max(Number(limit) || maxResults, 1), maxResults);
    const shared = `
      JOIN project_materials m ON m.project_id = b.project_id AND m.id = b.material_id
      JOIN material_qa_grants g ON g.project_id = b.project_id AND g.material_id = b.material_id
      WHERE b.project_id = ? AND m.status = 'ready' AND b.extraction_version = m.active_extraction_version
        AND g.enabled = 1 AND (g.audience = 'project_members' OR (? = 'editor' AND g.audience = 'editors'))`;

    // 虚谷和 SQLite 短词都用 LIKE
    // SQLite 长词用 FTS5 MATCH; 虚谷长词也用 LIKE（待虚谷全文索引验证后切换 CONTAINS）
    const useLike = xugu || [...value].length < 3;
    const escaped = `%${value.replace(/[%_]/g, "\\$&")}%`;

    let rows;
    if (useLike) {
      rows = database.prepare(
        `SELECT ${columns} FROM evidence_blocks b ${shared} AND (b.text LIKE ? ESCAPE '\\' OR b.summary LIKE ? ESCAPE '\\') ORDER BY b.material_id, b.ordinal LIMIT ?`
      ).all(projectId, access(audience), escaped, escaped, capped);
    } else {
      const phrase = `"${value.replaceAll('"', '""')}"`;
      rows = database.prepare(
        `SELECT ${columns}, bm25(evidence_fts) AS rank FROM evidence_fts JOIN evidence_blocks b ON b.id = evidence_fts.rowid ${shared} AND evidence_fts MATCH ? ORDER BY rank, b.material_id, b.ordinal LIMIT ?`
      ).all(projectId, access(audience), phrase, capped);
    }
    return rows.map(decode);
  }

  return Object.freeze({ list, get, search });
}
