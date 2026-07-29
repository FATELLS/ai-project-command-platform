export const MATERIAL_TEMPLATE_OPTIONS = Object.freeze([
  { id: "meeting-notes", label: "会议纪要" },
  { id: "project-plan", label: "项目计划" },
  { id: "progress-report", label: "进度汇报" },
  { id: "metrics-data", label: "指标数据" },
  { id: "outcome-archive", label: "成果归档" },
  { id: "new-project-material", label: "项目创建材料" }
]);

const MATERIAL_TEMPLATE_CONTENT = Object.freeze({
  "meeting-notes": `# 会议纪要

> 上传时请选择“更新模板：会议纪要”

## 基本信息
- 会议日期：YYYY-MM-DD
- 参会人员：
- 会议主题：

## 讨论内容
1.
2.

## 行动项（必填）
- [ ] 负责人：______ 任务：______ 截止：YYYY-MM-DD

## 备注
`,
  "project-plan": `# 项目计划

> 上传时请选择“更新模板：项目计划”

## 项目目标（必填）
具体、可衡量的项目目标：

## 团队/作战单元（必填）
| 角色 | 姓名 | 职责 |
|------|------|------|
|      |      |      |

## 里程碑与任务（必填）
| 里程碑 | 预计完成 | 状态 | 关键交付物 |
|--------|----------|------|------------|
| M1     | YYYY-MM-DD | 未启动 |          |

## 关键依赖
-

## 风险预案
-
`,
  "progress-report": `# 进度汇报

> 上传时请选择“更新模板：进度汇报”

## 汇报周期（必填）
截至日期：YYYY-MM-DD

## 进度概览（必填）
| 事项 | 进度/状态 | 说明 |
|------|-----------|------|
|      |           |      |

## 本期完成
-

## 下一步计划
-

## 风险与阻塞
-
`,
  "metrics-data": `# 指标数据

> 上传时请选择“更新模板：指标数据”

## 数据周期（必填）
YYYY-MM-DD 或 YYYY年M月

## 指标数据（必填）
| 指标名称 | 数值 | 单位 | 备注 |
|----------|------|------|------|
|          |      |      |      |

## 趋势说明
- 环比变化：
- 同比变化：
`,
  "outcome-archive": `# 成果归档

> 上传时请选择“更新模板：成果归档”

## 成果名称（必填）

## 成果说明（必填）
- 形成了什么结果：
- 对项目产生了什么影响：

## 成果来源（必填）
- 来源材料/链接/记录：

## 完成日期
YYYY-MM-DD

## 关联阶段或任务
-
`,
  "new-project-material": `# 项目创建材料

## 项目名称（必填）
项目名称：

## 项目目标（必填）
项目目标：

## 范围与交付物
- 项目范围：
- 关键交付物：

## 初始团队或作战单元（必填）
| 团队/角色 | 负责人 | 职责 |
|-----------|--------|------|
|           |        |      |

## 里程碑与任务
| 里程碑/任务 | 负责人 | 计划日期 |
|-------------|--------|----------|
|             |        | YYYY-MM-DD |

## 风险与约束
-
`
});

export function downloadMaterialTemplate(templateId, documentRef = document) {
  const option = MATERIAL_TEMPLATE_OPTIONS.find(item => item.id === templateId);
  const content = MATERIAL_TEMPLATE_CONTENT[templateId];
  if (!option || !content) return false;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = url;
  anchor.download = `${templateId}-模板.md`;
  documentRef.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}
