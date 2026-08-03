# 通用项目元素 Schema

## 设计原则

项目页面只有一种基础卡片结构。任务、作战单元、阶段、成果、战线、风险和指标通过 `element_type` 与属性表达，不使用多套业务表。

## project_cards

| 字段 | 含义 |
|---|---|
| `version_id` | 所属不可变版本 |
| `external_id` | 项目内稳定元素 ID |
| `element_type` | task/unit/stage/outcome/workstream/risk/metric |
| `position` | 稳定排序 |
| `title` | 标题 |
| `owner` | 负责人 |
| `state` | todo/doing/review/done |
| `objective` | 目标或范围 |
| `start_date` / `end_date` | ISO 日期或项目可读时间标签 |
| `progress` | 0-100 或空值 |
| `health` | on-track/at-risk/off-track |
| `unit_id` / `parent_id` | 归属和父元素 |
| `card_attrs` | 类型特有及扩展 JSON |
| `created_at` / `updated_at` | 审计时间 |

唯一键为 `(version_id, external_id)`。

## project_card_links

显式保存依赖、父子和其他图关系，关系两端必须属于同一 `version_id`。图校验在写入前检查目标存在、单元归属、重复边、跨单元限制和循环。

## 属性分级

- P0：title、objective、owner、start/end、state、progress、health、unit/parent。
- P1：stakeholders、deliverables、risks。
- P2：acceptanceCriteria、decisions、expectedOutput。

P0 公共属性放表列，便于查询、排序和索引；P1/P2 与类型特有属性序列化到 `card_attrs`。所有 JSON 在服务层通过结构化解析和白名单校验，不使用字符串拼接修改。

## 读写方

- 导入/导出：`src/migration/legacy-project.mjs`
- 仓储：`src/repositories/project-repository.mjs`
- 版本：`src/versions/version-store.mjs`
- 审核应用：`src/review/version-apply.mjs`
- 发布事实：`src/ai/published-facts.mjs`
- UI：`public/modules/renderers.js`

这些模块必须共享同一模型，不允许建立平行关系表或双写。
