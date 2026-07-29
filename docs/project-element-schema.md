# 通用项目元素 Schema 设计

> 核心思想：从材料到卡片，应该由提示词驱动。LLM 参照 PMBOK 理论框架，
> 从非结构化材料中提取 7 个通用项目元素域，每个元素域直接对应一种卡片。
> 渲染层不再硬编码字段，而是按 LLM 输出的元素 schema 动态渲染。

---

## 一、设计原则

### 1. 理论归并
PMBOK 6 的 10 个知识领域 + PMBOK 7 的 8 个绩效域，归并为 **7 个通用元素域**。
归并标准：跨项目类型（销售/研发/工程/市场/管理）都能找到对应实体。

### 2. 类型无关
7 个元素域的字段定义是**通用的**，但每个字段在不同项目类型下的**值域**不同。
提示词按项目类型调整提取权重和值域映射，但 schema 结构不变。

### 3. 卡片直映
每个元素域 = 一种卡片类型。LLM 输出的每个元素实例，直接对应一张卡片。
不需要经过 loaders.mjs 的硬编码投影，渲染器按 schema 通用渲染。

---

## 二、7 个通用元素域

### ① 目标与范围 ObjectiveCard

**PMBOK 来源**：整合管理 + 范围管理 + 价值交付

**字段定义**：
```json
{
  "elementType": "objective",
  "id": "obj-001",
  "goal": "完成推荐引擎 2.0 升级，召回率提升至 85%",
  "successCriteria": [
    "召回率 ≥ 85%",
    "首响时间 < 200ms",
    "AB 测试转化率提升 15%"
  ],
  "scope": {
    "included": ["算法重写", "AB 测试平台", "灰度发布"],
    "excluded": ["前端 UI 改版", "数据仓库迁移"]
  },
  "boundary": "仅限推荐服务后端，不涉及搜索服务",
  "priority": "high",
  "evidenceIds": ["ev-001", "ev-003"]
}
```

**跨类型适配**：
| 项目类型 | goal 示例 | successCriteria 示例 |
|---------|----------|---------------------|
| 销售 | 签约金额 5000 万 | 合同签订、首付款到账 |
| 研发 | 推荐召回率 85% | 上线、AB 测试通过 |
| 工程 | 大楼竣工交付 | 验收通过、安全零事故 |
| 市场 | 市场份额 15% | 渠道覆盖、品牌指数 |
| 管理 | 人效提升 20% | OKR 达成、离职率下降 |

---

### ② 里程碑与进度 MilestoneCard

**PMBOK 来源**：进度管理 + 生命周期

**字段定义**：
```json
{
  "elementType": "milestone",
  "id": "ms-001",
  "phase": "需求分析",
  "title": "完成推荐策略 PRD 评审",
  "startDate": "2026-07-01",
  "endDate": "2026-07-15",
  "state": "completed",
  "progress": 100,
  "gateCriteria": ["PRD 评审通过", "技术方案确认"],
  "owner": "张三",
  "dependsOn": ["ms-000"],
  "evidenceIds": ["ev-005", "ev-008"]
}
```

**state 枚举（跨类型统一）**：
- `planned` — 待启动
- `active` — 进行中
- `blocked` — 阻塞
- `review` — 待审核/待验收
- `completed` — 已完成
- `cancelled` — 已取消

---

### ③ 人员与角色 RoleCard（新增）

**PMBOK 来源**：资源管理 + 团队 + 相关方

**字段定义**：
```json
{
  "elementType": "role",
  "id": "role-001",
  "name": "张三",
  "role": "技术负责人",
  "responsibility": "架构设计、技术方案决策、代码审核",
  "capacity": "全职",
  "capacityPercent": 100,
  "organization": "推荐算法组",
  "contact": "zhangsan@example.com",
  "stakeholderType": "internal",
  "influence": "high",
  "evidenceIds": ["ev-002"]
}
```

**role 枚举**：
- `sponsor` — 项目发起人
- `manager` — 项目经理
- `tech_lead` — 技术负责人
- `developer` — 开发者
- `designer` — 设计师
- `qa` — 质量负责人
- `sales` — 销售
- `client` — 客户
- `vendor` — 供应商

---

### ④ 交付与成果 DeliverableCard

**PMBOK 来源**：交付 + 质量管理

**字段定义**：
```json
{
  "elementType": "deliverable",
  "id": "dlv-001",
  "name": "推荐算法 v2 技术方案文档",
  "type": "document",
  "status": "accepted",
  "acceptanceCriteria": "方案通过架构委员会评审",
  "qualityGrade": "A",
  "deliveredDate": "2026-07-20",
  "owner": "张三",
  "linkedMilestone": "ms-001",
  "evidenceIds": ["ev-010"]
}
```

**type 枚举**：
- `document` — 文档
- `code` — 代码
- `design` — 设计稿
- `report` — 报告
- `prototype` — 原型
- `product` — 产品/交付物
- `service` — 服务上线

**status 枚举**：
- `drafting` — 编写中
- `in_review` — 评审中
- `revision` — 需修改
- `accepted` — 已验收
- `rejected` — 已驳回

---

### ⑤ 风险与问题 RiskCard

**PMBOK 来源**：风险管理 + 不确定性

**字段定义**：
```json
{
  "elementType": "risk",
  "id": "risk-001",
  "title": "召回率可能达不到 85% 目标",
  "category": "technical",
  "severity": "high",
  "probability": 60,
  "impact": "直接影响项目核心目标",
  "mitigation": "增加召回策略对比实验，预留 2 周调优窗口",
  "contingency": "降级使用 v1 召回策略，保证可用性",
  "owner": "李四",
  "dueDate": "2026-08-01",
  "status": "monitoring",
  "trigger": "AB 测试召回率连续 3 天低于 80%",
  "evidenceIds": ["ev-015"]
}
```

**category 枚举**：
- `technical` — 技术风险
- `schedule` — 进度风险
- `resource` — 资源风险
- `budget` — 预算风险
- `external` — 外部风险
- `quality` — 质量风险
- `compliance` — 合规风险

**severity 枚举**：`low` / `medium` / `high` / `critical`

---

### ⑥ 指标与评价 MetricCard

**PMBOK 来源**：成本管理 + 测量

**字段定义**：
```json
{
  "elementType": "metric",
  "id": "met-001",
  "name": "推荐召回率",
  "value": 78.5,
  "target": 85,
  "unit": "%",
  "trend": "up",
  "asOf": "2026-07-25",
  "category": "quality",
  "direction": "higher_better",
  "status": "at_risk",
  "evidenceIds": ["ev-020"]
}
```

**trend 枚举**：`up` / `down` / `flat` / `unknown`
**direction 枚举**：`higher_better` / `lower_better` / `target_range`
**status 枚举**：`on_track` / `at_risk` / `off_track` / `achieved`

**跨类型适配**：
| 项目类型 | 典型 metric | 典型 unit |
|---------|------------|----------|
| 销售 | 签约金额、转化率 | 万元、% |
| 研发 | 代码覆盖率、缺陷密度 | %、个/千行 |
| 工程 | 施工进度、安全事故数 | %、次 |
| 市场 | 市场份额、ROI | %、倍 |
| 管理 | 人效、离职率 | 万元/人、% |

---

### ⑦ 决策与变更 DecisionCard（新增）

**PMBOK 来源**：整合管理（变更控制）

**字段定义**：
```json
{
  "elementType": "decision",
  "id": "dec-001",
  "topic": "推荐策略从规则引擎切换到深度学习",
  "decided": true,
  "decision": "采用混合策略：规则引擎兜底 + 深度学习主路",
  "rationale": "深度学习召回率高但冷启动差，规则引擎保证可用性",
  "decidedBy": "架构委员会",
  "decidedDate": "2026-07-10",
  "impactScope": ["算法架构", "数据管线", "AB 测试平台"],
  "alternatives": [
    "纯规则引擎（保守）",
    "纯深度学习（激进）"
  ],
  "status": "implemented",
  "evidenceIds": ["ev-012"]
}
```

**status 枚举**：
- `proposed` — 提议中
- `under_review` — 审议中
- `decided` — 已决定
- `implemented` — 已实施
- `superseded` — 已被取代

---

## 三、提示词改造方案

### 当前提示词 vs 改造后

**当前**（prompt-builder.mjs）：
```
LLM 只输出 changes[]（module/operation/patch），不知道卡片怎么渲染。
泳道名称、字段选择全靠 renderers.js 硬编码。
```

**改造后**：
```json
{
  "elements": {
    "objectives": [ObjectiveCard, ...],
    "milestones": [MilestoneCard, ...],
    "roles": [RoleCard, ...],
    "deliverables": [DeliverableCard, ...],
    "risks": [RiskCard, ...],
    "metrics": [MetricCard, ...],
    "decisions": [DecisionCard, ...]
  },
  "layout": {
    "milestoneBoard": {
      "lanes": [
        {"id": "planned", "title": "待启动", "order": 1},
        {"id": "active", "title": "推进中", "order": 2},
        {"id": "review", "title": "待验收", "order": 3},
        {"id": "completed", "title": "已完成", "order": 4}
      ],
      "groupBy": "phase"
    }
  }
}
```

### System Prompt 核心改造

```
你是项目元素提取器。参照 PMBOK 理论框架，从非结构化材料中提取 7 个通用项目元素域。
每个元素域的字段定义见 output_contract.elements。
所有提取必须基于 evidence，不得编造。
跨项目类型（销售/研发/工程/市场/管理）使用同一套 schema，但字段值域按材料内容实例化。
```

---

## 四、渲染层改造方案

### 当前 vs 改造后

**当前**：
- `renderRoadmapBoard`（130 行）— 硬编码 4 条泳道、卡片字段
- `renderUnits`（120 行）— 硬编码作战单元卡片字段
- `renderTaskNetwork`（80 行）— 硬编码任务节点
- 每个视图一个专用函数，字段写死

**改造后**：
```javascript
// 一个通用渲染器
function renderElementCards(context) {
  const { elements, layout } = context.data;
  // layout.lanes 决定泳道
  // element.fields 决定卡片显示什么
  // 不再硬编码任何字段名或泳道名称
  return renderBoard(layout.milestoneBoard.lanes, elements.milestones, layout.milestoneBoard.groupBy);
}
```

新增 2 个通用渲染器替代 9 个专用函数：
1. `renderCardBoard` — 按泳道/分组渲染卡片板
2. `renderCardList` — 按列表渲染卡片列表

---

## 五、存储架构：Table + JSON 混合模式

### 设计原则

**公共字段 = P0 必备** → 提为表列（有结构约束、能 WHERE/ORDER BY）
**非公共但项目相关 = P1/P2 + 类型特有** → 追加到 `card_attrs` JSON

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
├── title           VARCHAR(512) (所有卡片都有)
├── owner           VARCHAR(256) (负责人)
├── state           VARCHAR(20)  (状态枚举)
├── objective       CLOB         (目标/范围)
├── start_date      VARCHAR(40)  (开始日期)
├── end_date        VARCHAR(40)  (截止日期)
├── progress        SMALLINT     (0-100)
├── health          VARCHAR(20)  (on-track/at-risk/off-track)
│
│   ── 结构关系（表列，支持 FK 约束）──
├── unit_id         VARCHAR(128) (所属单元)
├── parent_id       VARCHAR(128) (父卡片)
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

## 五、跨类型归并对照表

| 通用元素域 | 销售项目 | 研发项目 | 工程实施 | 市场拓展 | 内部管理 |
|-----------|---------|---------|---------|---------|---------|
| ① 目标 | 签约额 | 上线 | 竣工 | 份额 | 人效 |
| ② 里程碑 | 拜访→投标→签约 | 需求→开发→上线 | 设计→施工→验收 | 调研→投放→复盘 | 诊断→方案→落地 |
| ③ 人员 | 客户经理 | 产品经理 | 项目经理 | 市场总监 | 变革负责人 |
| ④ 交付 | 合同 | 代码 | 建筑物 | 广告方案 | 流程文档 |
| ⑤ 风险 | 客户流失 | 技术债 | 工期延误 | 预算超支 | 员工抵触 |
| ⑥ 指标 | 转化率 | 缺陷率 | 安全事故 | ROI | 满意度 |
| ⑦ 决策 | 报价策略 | 技术选型 | 材料选择 | 渠道策略 | 组织架构 |

**关键**：schema 结构完全相同，只是字段值不同。提示词根据材料内容自动适配。
