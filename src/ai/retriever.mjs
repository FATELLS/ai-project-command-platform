const stopTerms = new Set(["什么", "如何", "是否", "请问", "项目", "目前", "这个", "那个", "the", "what", "when", "where", "which", "project"]);

export function buildFtsTerms(question, maxTerms = 16) {
  const normalized = String(question ?? "").normalize("NFKC").toLowerCase().slice(0, 1_000);
  const terms = [];
  for (const token of normalized.match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (/^[\p{Script=Han}]+$/u.test(token) && token.length > 4) {
      for (let index = 0; index <= token.length - 3; index += 1) terms.push(token.slice(index, index + 3));
    } else if (token.length >= 2) terms.push(token);
  }
  return [...new Set(terms.filter(term => !stopTerms.has(term)))].slice(0, maxTerms);
}

function rowToHit(row) {
  return {
    evidenceId: row.evidenceId,
    materialId: row.materialId,
    kind: row.kind,
    location: JSON.parse(row.locationJson),
    text: row.text,
    summary: row.summary,
    rank: row.rank,
  };
}

export function createEvidenceRetriever(database, options = {}) {
  const topK = Math.min(options.topK ?? 8, 8);
  const xugu = database?._backend === "xugu";

  // 检测 FTS5 是否可用（sql.js 默认不含 FTS5）
  let ftsAvailable = null;
  function hasFts() {
    if (ftsAvailable !== null) return ftsAvailable;
    try {
      const row = database.prepare("SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name='evidence_fts'").get();
      ftsAvailable = row && row.c > 0;
    } catch { ftsAvailable = false; }
    return ftsAvailable;
  }

  function search({ projectId, question, audience = "project_member" }) {
    const terms = buildFtsTerms(question);
    if (!terms.length) return [];
    const access = audience === "editor" ? "editor" : "project_member";

    let rows = [];

    if (xugu || !hasFts()) {
      // 虚谷后端或 sql.js(无FTS5): 使用 LIKE 查询
      const validTerms = terms.filter(term => [...term].length >= 2);
      if (validTerms.length) {
        // 构建 OR 条件
        const conditions = validTerms.map(() => "(b.text LIKE ? OR b.summary LIKE ?)").join(" OR ");
        const params = [];
        for (const term of validTerms) {
          const escaped = `%${term.replace(/[%_]/g, "\\$&")}%`;
          params.push(escaped, escaped);
        }
        rows = database.prepare(`
          SELECT b.external_id AS evidenceId, b.material_id AS materialId, b.kind, b.location_json AS locationJson,
            b.text, b.summary, 0.0 AS rank
          FROM evidence_blocks b
          JOIN project_materials m ON m.project_id = b.project_id AND m.id = b.material_id
          JOIN material_qa_grants g ON g.project_id = b.project_id AND g.material_id = b.material_id
          WHERE b.project_id = ? AND m.status = 'ready'
            AND b.extraction_version = m.active_extraction_version AND g.enabled = 1
            AND (g.audience = 'project_members' OR (? = 'editor' AND g.audience = 'editors'))
            AND (${conditions})
          ORDER BY b.external_id ASC LIMIT ?
        `).all(projectId, access, ...params, topK);
      }
    } else {
      // SQLite 后端: 使用 FTS5
      const expression = terms.filter(term => [...term].length >= 3).map(term => `"${term.replaceAll('"', '""')}"`).join(" OR ");
      if (expression) {
        rows = database.prepare(`
          SELECT b.external_id AS evidenceId, b.material_id AS materialId, b.kind, b.location_json AS locationJson,
            b.text, b.summary, bm25(evidence_fts) AS rank
          FROM evidence_fts JOIN evidence_blocks b ON b.id = evidence_fts.rowid
          JOIN project_materials m ON m.project_id = b.project_id AND m.id = b.material_id
          JOIN material_qa_grants g ON g.project_id = b.project_id AND g.material_id = b.material_id
          WHERE evidence_fts MATCH ? AND b.project_id = ? AND m.status = 'ready'
            AND b.extraction_version = m.active_extraction_version AND g.enabled = 1
            AND (g.audience = 'project_members' OR (? = 'editor' AND g.audience = 'editors'))
          ORDER BY rank ASC, b.external_id ASC LIMIT ?
        `).all(expression, projectId, access, topK);
      }
    }

    if (!rows.length) {
      const short = terms.find(term => [...term].length === 2);
      if (short) rows = database.prepare(`
        SELECT b.external_id AS evidenceId, b.material_id AS materialId, b.kind, b.location_json AS locationJson,
          b.text, b.summary, 0.0 AS rank
        FROM evidence_blocks b JOIN project_materials m ON m.project_id = b.project_id AND m.id = b.material_id
        JOIN material_qa_grants g ON g.project_id = b.project_id AND g.material_id = b.material_id
        WHERE b.project_id = ? AND m.status = 'ready' AND b.extraction_version = m.active_extraction_version
          AND g.enabled = 1 AND (g.audience = 'project_members' OR (? = 'editor' AND g.audience = 'editors'))
          AND b.text LIKE ? ESCAPE '\\' ORDER BY b.external_id LIMIT ?
      `).all(projectId, access, `%${short.replace(/[\\%_]/g, "\\$&")}%`, topK);
    }
    return rows.map(rowToHit);
  }
  return Object.freeze({ search, topK });
}
