# 通用项目元素 Schema 设计

> 核心思想：从材料到卡片，应该由提示词驱动。卡片就是卡片——前端 UI 上的任务卡片，
> 不分种类。卡片沿项目生命周期推进（待启动→进行中→已完成），推进就是项目的进度。
> LLM 参照 PMBOK 理论框架，从材料中提取通用项目元素，输出直接对应卡片属性。

---

## 一、设计原则

### 1. 一种卡片
卡片是项目生命周期的推进单元。不管什么项目类型、什么阶段，UI 上呈现的都是同一种卡片。卡片属性由 PMBOK 通用项目元素驱动，不是按"种类"分。

### 2. 元素驱动
参照 PMBOK 6 的 10 个知识领域 + PMBOK 7 的 8 个绩效域，归并为通用项目元素集。这些元素直接对应卡片属性，分为三档优先级（P0 必选 / P1 条件必选 / P2 可选增强）。

### 3. 类型无关
属性结构跨项目类型统一（销售/研发/工程/市场/管理），只是字段值域语义不同。提示词根据材料内容自动适配值域。

### 4. 跨类型归并
| 通用元素 | 销售项目 | 研发项目 | 工程实施 | 市场拓展 | 内部管理 |
|---------|---------|---------|---------|---------|---------|
| 目标 | 签约额 | 上线 | 竣工 | 份额 | 人效 |
| 里程碑 | 拜访→投标→签约 | 需求→开发→上线 | 设计→施工→验收 | 调研→投放→复盘 | 诊断→方案→落地 |
| 人员 | 客户经理 | 产品经理 | 项目经理 | 市场总监 | 变革负责人 |
| 交付 | 合同 | 代码 | 建筑物 | 广告方案 | 流程文档 |
| 风险 | 客户流失 | 技术债 | 工期延误 | 预算超支 | 员工抵触 |
| 指标 | 转化率 | 缺陷率 | 安全事故 | ROI | 满意度 |
| 决策 | 报价策略 | 技术选型 | 材料选择 | 渠道策略 | 组织架构 |

**关键**：卡片结构完全相同，只是属性值不同。提示词根据材料内容自动适配。

---

## 二、卡片属性分级

### P0 · 必选（每次都尝试提取）

这些字段是每张卡片的核心，对应 `project_cards` 表列，支持 WHERE / ORDER BY / INDEX：

| 属性 | 说明 | 提取来源 | 格式/枚举 |
|------|------|---------|----------|
| `title` | 标题 | 材料中的讨论主题、待办事项 | 字符串 |
| `objective` | 目标/范围 | "讨论了什么""目标是" | 字符串 |
| `owner` | 负责人 | 参会人、被指派的人 | 字符串 |
| `startDate` | 开始日期 | 材料中的日期 | ISO `YYYY-MM-DD` |
| `endDate` | 截止日期 | 材料中的截止/完成日期 | ISO `YYYY-MM-DD` |
| `state` | 状态 | "未开始/进行中/已完成/评审中" | `todo` / `doing` / `review` / `done` |
| `progress` | 进度 | 进度汇报、百分比 | 0-100 整数 / `null` |
| `health` | 健康度 | 材料语气（困难/延期/顺利） | `on-track` / `at-risk` / `off-track` |

结构关系字段（也存为表列）：

| 属性 | 说明 |
|------|------|
| `unitId` | 所属作战单元 |
| `parentId` | 父任务 |
| `dependsOn` | 前置依赖数组 |

### P1 · 条件必选（遇到就提取，没遇到跳过）

这些字段存入 `card_attrs` JSON：

| 属性 | 说明 | 格式 |
|------|------|------|
| `stakeholders` | 相关方（除负责人外） | JSON 数组 `["张三(产品)", "李四(测试)"]` |
| `deliverables` | 交付物 | JSON 数组 `[{"name":"需求文档","state":"done"}]` |
| `risks` | 任务级风险 | JSON 数组 `[{"title":"接口未就绪","severity":"high","status":"open"}]` |

**适用场景**：评审会、周报、收尾会常有；日常站会不一定。

### P2 · 可选增强（需专门材料或多次累积）

| 属性 | 说明 | 格式 |
|------|------|------|
| `acceptanceCriteria` | 验收标准——怎样算"完成" | 字符串 |
| `decisions` | 决策记录 | JSON 数组 `[{"date":"2026-07-14","summary":"采用方案A","decidedBy":"张三"}]` |
| `expectedOutput` | 预期产出（acceptanceCriteria 缺失时兜底） | 字符串 |

**适用场景**：需求评审/验收会议、决策会/评审会。

### 类型特有属性（按 element_type 不同出现在 card_attrs）

| element_type | 特有字段 | 说明 |
|-------------|---------|------|
| `risk` | `severity`, `mitigation`, `dueDate` | 严重级别、缓解措施、截止日期 |
| `metric` | `value`, `target`, `unit`, `asOf` | 当前值、目标值、单位、时间点 |
| `unit` / `metric` | `status` | 细分状态 |
| `stage` / `outcome` | `dateLabel`, `description`, `result` | 日期标签、描述、结果 |

---

## 三、提示词实现

### 当前实现（`prompt-builder.mjs`）

系统提示词已经围绕 PMBOK 元素提取：

```
你是项目结构化更新提案转换器。你的核心职责是：从材料中提取通用项目元素，
输出结构化的任务卡片属性。卡片是项目生命周期的推进单元——沿待启动→进行中→已完成
向前推进。每张卡片承载一套通用项目元素（参照 PMBOK 项目管理理论归并）。

从材料中围绕以下通用项目元素提取内容。元素分三档优先级：
【P0 · 必选】title, objective, owner, stakeholders, startDate, endDate, state, progress, health
【P1 · 条件必选】deliverables, risks
【P2 · 可选增强】acceptanceCriteria, decisions
```

提示词关键规则：
- P0 字段新材料覆盖旧值；P1/P2 数组字段追加（去重）
- 只输出本次材料能补充的字段，不重复已有值
- 所有日期 ISO 格式，不编造日期
- 数组字段用 JSON 数组，不用逗号分隔字符串
- health/severity/state 必须用指定枚举值

### 提取上下文（`catalog.mjs`）

`cardElementLevels` 定义三档分��（提取端和输入端共用）：

```javascript
cardElementLevels = {
  required: ["title", "objective", "owner", "stakeholders", "startDate", "endDate", "state", "progress", "health"],
  conditional: ["deliverables", "risks"],
  optional: ["acceptanceCriteria", "decisions"]
}
```

`cardStorageMap` 定义存储映射（公共字段→表列，差异字段→JSON）：

```javascript
cardStorageMap = {
  columns: ["title", "owner", "state", "objective", "startDate", "endDate", "progress", "health", "unitId", "parentId", "dependsOn"],
  attrs: ["stakeholders", "deliverables", "risks", "acceptanceCriteria", "decisions", "expectedOutput", ...]
}
```

---

## 四、存储架构：Table + JSON 混合模式

### project_cards 统一卡片表

替代之前的 8 张分表（project_tasks, project_units, project_stages, project_closures, project_workstreams, project_risks, project_metrics + task_links）。

```
project_cards
├── version_id      INTEGER      (版本快照)
├── external_id     VARCHAR(128) (卡片唯一标识)
├── element_type    VARCHAR(30)  (task/unit/stage/outcome/workstream/risk/metric)
├── position        INTEGER      (排序)
│
│   ── P0 公共必备字段（表列）──
├── title           VARCHAR(512)
├── owner           VARCHAR(256)
├── state           VARCHAR(20)  (todo/doing/review/done)
├── objective       CLOB         (目标/范围)
├── start_date      VARCHAR(40)  (ISO 日期)
├── end_date        VARCHAR(40)  (ISO 日期)
├── progress        SMALLINT     (0-100)
├── health          VARCHAR(20)  (on-track/at-risk/off-track)
│
│   ── 结构关系（表列，支持 FK 约束）──
├── unit_id         VARCHAR(128)
├── parent_id       VARCHAR(128)
├── depends_on      JSON         (前置依赖数组)
│
│   ── 非公共属性（JSON 追加）──
├── card_attrs      JSON         (P1/P2 + 类型特有字段)
│
├── created_at      VARCHAR(40)
└── updated_at      VARCHAR(40)
```

### 字段划分对照

| 存储位置 | 字段 | 说明 |
|---------|------|------|
| **表列** | title, owner, state, objective, start_date, end_date, progress, health | P0 必备，所有卡片都有 |
| **表列** | unit_id, parent_id, depends_on | 结构关系，需 FK 约束和图查询 |
| **card_attrs** | stakeholders, deliverables, risks, acceptanceCriteria, decisions, expectedOutput | P1/P2 条件/可选 |
| **card_attrs** | severity, mitigation, value, target, unit, source, dateLabel, description, result | 类型特有 |

### 虚谷 JSON 能力

虚谷有原生 JSON 类型（2GB 上限，28 个函数），完全支撑这个模式：
- `JSON_VALID(card_attrs)` — CHECK 约束验证
- `JSON_VALUE(card_attrs, '$.severity')` — 函数索引加速查询
- `JSON_MERGE_PATCH(card_attrs, ?)` — 增量合并更新
- `JSON_EXTRACT(card_attrs, '$.deliverables')` — 提取数组

### 双后端兼容

- SQLite: `card_attrs TEXT` + `json_valid()` + `json_extract()` + `json_patch()`
- 虚谷: `card_attrs JSON` + `JSON_VALID()` + `JSON_VALUE()` + `JSON_MERGE_PATCH()`

### 数据迁移

migration 008（虚谷）/ 010（SQLite）自动将旧表数据导入 project_cards：
1. project_tasks → element_type='task'
2. project_units → element_type='unit'
3. project_stages → element_type='stage'
4. project_closures → element_type='outcome'
5. project_workstreams → element_type='workstream'
6. project_risks → element_type='risk'
7. project_metrics → element_type='metric'
8. task_links → project_card_links

旧表保留不删，作为回滚安全网。

### 渐进迁移策略

`project-repository.mjs` 和 `version-apply.mjs` 使用 `tableExists("project_cards")` 检测：
- 如果表存在 → 走统一卡片表路径
- 如果表不存在 → 回退到旧的 8 表路径

这确保在 migration 执行前后系统都能正常工作。

---

## 五、相关文件

| 文件 | 职责 |
|------|------|
| `src/proposals/prompt-builder.mjs` | 系统提示词 + 输出契约 + 上下文构建 |
| `src/proposals/catalog.mjs` | 字段定义、三档分级、存储映射、模板注册 |
| `src/db/migrations/010_unified_cards.sql` | SQLite 统一卡片表 migration |
| `src/db/xugu-migrations/008_unified_cards.sql` | 虚谷统一卡片表 migration |
| `src/repositories/project-repository.mjs` | 读取适配（`loadCardsFromUnifiedTable`） |
| `src/review/version-apply.mjs` | 写入适配（`writeCard` / `splitPatch`） |
| `src/modules/loaders.mjs` | 数据加载器（渐进迁移中） |
| `public/modules/renderers.js` | 卡片渲染 + 路线图泳道 + 卡片编辑器 |
