const templateLabels = Object.freeze({
  "meeting-notes": "会议纪要",
  "project-plan": "项目计划",
  "progress-report": "进度汇报",
  "metrics-data": "指标数据",
  "outcome-archive": "成果归档",
  "new-project-material": "新项目材料"
});

const rules = Object.freeze({
  "meeting-notes": [
    required("action_items", "行动项", ["行动", "任务", "待办", "跟进", "推进", "需要", "负责"]),
    optional("responsible_unit", "负责人或作战单元", ["负责人", "负责", "作战单元", "团队", "owner", "unit"]),
    optional("source_date", "会议日期或来源", ["会议", "纪要", "日期", "时间", "来源", "记录"])
  ],
  "project-plan": [
    required("project_goal", "项目目标", ["目标", "愿景", "范围", "交付"]),
    required("units", "团队或作战单元", ["团队", "作战单元", "小组", "负责人"]),
    required("tasks", "任务或里程碑", ["任务", "里程碑", "路线", "计划", "阶段"])
  ],
  "progress-report": [
    required("as_of", "截至日期或汇报周期", ["截至", "日期", "周期", "本周", "今日", "进度"]),
    required("status", "状态或进度事实", ["完成", "进度", "状态", "风险", "阻塞", "%"]),
    optional("next_actions", "下一步行动", ["下一步", "后续", "计划", "跟进"])
  ],
  "metrics-data": [
    required("metric_name", "指标名称", ["指标", "metric", "kpi"]),
    required("metric_value", "指标值", ["数值", "value", "%", "率", "量", "得分"]),
    required("as_of", "指标日期", ["日期", "截至", "as of", "周期"])
  ],
  "outcome-archive": [
    required("outcome", "成果名称或结果", ["成果", "交付", "结果", "完成", "发布"]),
    required("source", "成果来源", ["来源", "证据", "链接", "归档", "记录"]),
    optional("date", "成果日期", ["日期", "时间", "完成于", "发布于"])
  ],
  "new-project-material": [
    required("project_name", "项目名称", ["项目", "名称", "project"]),
    required("project_goal", "项目目标", ["目标", "愿景", "使命", "范围"]),
    required("initial_units", "初始团队或作战单元", ["团队", "作战单元", "负责人", "成员"]),
    optional("initial_plan", "初始路线或任务", ["任务", "路线", "里程碑", "计划"])
  ]
});

function required(id, label, keywords) { return Object.freeze({ id, label, keywords, critical: true }); }
function optional(id, label, keywords) { return Object.freeze({ id, label, keywords, critical: false }); }
function normalize(value) { return String(value ?? "").normalize("NFKC").toLocaleLowerCase("zh-CN"); }
function timestamp(now) { return new Date(now()).toISOString(); }

function evaluate(templateId, rows) {
  const text = normalize(rows.map(row => row.text).join("\n"));
  const selected = rules[templateId] ?? [];
  const missing = [];
  const warnings = [];
  const evidence = [];
  for (const rule of selected) {
    const matched = rule.keywords.find(keyword => text.includes(normalize(keyword)));
    if (matched) evidence.push({ id: rule.id, label: rule.label, keyword: matched });
    else if (rule.critical) missing.push({ id: rule.id, label: rule.label, severity: "critical" });
    else warnings.push({ id: rule.id, label: rule.label, severity: "warning" });
  }
  const status = missing.length ? "blocked" : warnings.length ? "warning" : "ready";
  const suggestion = missing.length
    ? `请补充${missing.map(item => item.label).join("、")}后再生成项目更新。`
    : warnings.length
      ? `可继续生成，但建议补充${warnings.map(item => item.label).join("、")}以降低人工审核成本。`
      : "材料关键内容覆盖充分，可以生成结构化更新提案。";
  return { status, missing, warnings, evidence, suggestion };
}

export function createMaterialReadinessService(database, options = {}) {
  const now = options.now ?? Date.now;

  function evidenceRows(projectId, materialId, extractionVersion) {
    return database.prepare(`
      SELECT external_id AS evidenceId, text
      FROM evidence_blocks
      WHERE project_id=? AND material_id=? AND extraction_version=?
      ORDER BY ordinal LIMIT 100
    `).all(projectId, materialId, extractionVersion);
  }

  function snapshot(input) {
    const rows = evidenceRows(input.projectId, input.materialId, input.extractionVersion);
    const result = evaluate(input.templateId, rows);
    return {
      template: {
        id: input.templateId,
        version: input.templateVersion ?? "1.0.0",
        label: templateLabels[input.templateId] ?? "更新模板"
      },
      extractionVersion: input.extractionVersion,
      evidenceCount: rows.length,
      ...result
    };
  }

  function latest(projectId, materialId, extractionVersion, templateId, templateVersion = "1.0.0") {
    const row = database.prepare(`
      SELECT status, missing_json AS missingJson, warnings_json AS warningsJson,
             evidence_json AS evidenceJson, suggestion, created_at AS createdAt
      FROM material_readiness_snapshots
      WHERE project_id=? AND material_id=? AND extraction_version=? AND template_id=? AND template_version=?
      ORDER BY id DESC LIMIT 1
    `).get(projectId, materialId, extractionVersion, templateId, templateVersion);
    if (!row) return null;
    return {
      template: { id: templateId, version: templateVersion, label: templateLabels[templateId] ?? "更新模板" },
      extractionVersion,
      status: row.status,
      missing: JSON.parse(row.missingJson),
      warnings: JSON.parse(row.warningsJson),
      evidence: JSON.parse(row.evidenceJson),
      suggestion: row.suggestion,
      createdAt: row.createdAt
    };
  }

  function compute(input) {
    if (!input.templateId || !input.extractionVersion) return null;
    return latest(input.projectId, input.materialId, input.extractionVersion, input.templateId, input.templateVersion)
      ?? snapshot(input);
  }

  function persist(input) {
    const value = snapshot(input);
    database.prepare(`
      INSERT INTO material_readiness_snapshots
        (project_id, material_id, extraction_version, template_id, template_version, status,
         missing_json, warnings_json, evidence_json, suggestion, created_by, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      input.projectId,
      input.materialId,
      input.extractionVersion,
      input.templateId,
      input.templateVersion ?? "1.0.0",
      value.status,
      JSON.stringify(value.missing),
      JSON.stringify(value.warnings),
      JSON.stringify(value.evidence),
      value.suggestion,
      input.createdBy ?? null,
      timestamp(now)
    );
    return latest(input.projectId, input.materialId, input.extractionVersion, input.templateId, input.templateVersion ?? "1.0.0");
  }

  return Object.freeze({ compute, persist, rules });
}
