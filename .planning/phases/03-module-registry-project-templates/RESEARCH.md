# Phase 3：模块注册表与项目模板 - Research

**Researched:** 2026-07-18
**Domain:** 版本化模块契约、项目模板、固定组件渲染、Xugu 视觉迁移
**Confidence:** HIGH

## User Constraints

### Locked Decisions

- 桌面界面与 Xugu Agentic Group Schedule 稳定应用基本一致；保持 76px 白色顶部导航、暖色指挥背景、左目标/右战况 Hero、横向章节卡片，不回到深色侧栏式 SaaS 壳。[VERIFIED: user direction, `.planning/DECISIONS.md` D-011]
- `xugu-agentic-group` 是首个项目，稳定 ID 不变；路线、任务、甘特和成果语义不得丢失。[VERIFIED: `AGENTS.md`, `.planning/DECISIONS.md` D-006]
- Banner、标题、状态、事实标签、模块文案由项目模板与术语数据驱动；标准项目不得继承 Xugu 作战文案。[VERIFIED: user direction, `.planning/DECISIONS.md` D-012]
- 页面只由仓库内固定组件渲染；项目数据、材料或 AI 输出不得提供或执行 HTML、CSS、JavaScript、SQL、Shell 或任意页面代码。[VERIFIED: `AGENTS.md`, `AI-SPEC.md`, `.planning/DECISIONS.md` D-003/D-010]
- LLM 只能产生带来源的结构化 `ChangeProposal`，不能直接写入 `draft` 或 `published`；Phase 3 不提前实现 AI、审核、发布或回滚。[VERIFIED: `AGENTS.md`, `AI-SPEC.md`, `.planning/ROADMAP.md`]
- 项目数据、模板解析、模块读取和权限判断都必须按 `projectId` 隔离。[VERIFIED: `AGENTS.md`, `.planning/REQUIREMENTS.md` AUTH-02]
- 参考 Xugu 仓库 `../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/` 默认只读，仅作为迁移来源与验收基线。[VERIFIED: `AGENTS.md`, `.planning/DECISIONS.md` D-001]

### Codex's Discretion

- 在现有无第三方运行依赖的 Node.js/SQLite/原生前端架构内，确定模块注册表、模板目录、版本化契约、模块读模型和固定渲染器的文件边界。[VERIFIED: current `package.json`, `src/`, `public/`]
- 确定 Phase 3 的模块 API 形状、模板默认模块启停/排序、空状态和验证分层，但不得改变上述锁定边界。[VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`]

### Deferred Ideas (OUT OF SCOPE)

- 材料上传/证据块/问答属于 Phase 4；材料模块本阶段只提供契约与安全空状态。[VERIFIED: `.planning/ROADMAP.md`]
- AI 结构化提案属于 Phase 5；差异审核、发布、回滚和完整审计属于 Phase 6。[VERIFIED: `.planning/ROADMAP.md`]
- 任意自定义代码模块、拖拽网页生成器、多机部署和实时多人协同不在首版范围。[VERIFIED: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`]

## Summary

Phase 1 已具备正确的扩展骨架：模板表、项目模板版本指针、按版本保存的 `project_modules`，以及作战单元、路线节点、闭环、任务、依赖和战线的规范化表；Phase 2 已把主题与术语解析到项目 API，并建立 Xugu 同构桌面壳。[VERIFIED: `001_initial.sql`, `project-repository.mjs`, Phase 2 `VERIFICATION.md`] 但当前模板定义分散在 `project-service.mjs`、迁移器和 `public/app.js`，九类模块仅以字符串数组存在，`project_modules.data_json` 没有版本化数据契约，前端仍把未来模块标为“即将开放”。[VERIFIED: `project-service.mjs`, `legacy-project.mjs`, `public/app.js`]

本阶段应把“可执行映射”与“项目配置”严格分开：本地代码注册表只允许九个已知 `moduleType` 映射到固定 renderer/loader/validator；模板目录只保存版本化、纯数据的术语、主题、模块默认顺序、允许的固定视图变体与空状态文案。[VERIFIED: D-003/D-010/D-012; architecture recommendation] 数据库继续保存模板版本和每个版本图的模块实例，不保存可执行代码或任意组件名称。[VERIFIED: existing schema; architecture recommendation]

**Primary recommendation:** 新增 migration 003 与共享模块/模板目录，使服务端注册表成为校验和读模型的唯一入口、前端 renderer map 成为展示的唯一入口；先迁移并回归 `xugu-agentic-group`，再以 `standard-project-v1` 的合成项目证明无需改页面代码即可完整展示。[VERIFIED: roadmap acceptance criteria; architecture recommendation]

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| MOD-01 | 九类基础模块 | 下文给出九类契约、数据源、固定 renderer 和空状态。 |
| MOD-02 | 受控前端组件渲染，不执行项目/LLM 代码 | 注册表只接受 allowlist type/viewVariant；DOM 只用 `textContent`/属性白名单。 |
| TPL-01 | 模板定义术语、必填模块、字段、状态、校验、默认视图和主题 | 模板 manifest 契约与创建/迁移规则见下文。 |
| TPL-02 | `campaign-map-v1` | 保留 Xugu 分支路线、作战术语、固定 campaign 视图变体。 |
| TPL-03 | 标准项目模板 | 使用团队/任务/里程碑/交付物术语和线性路线/泳道甘特。 |
| NFR-04 | 模板和 Schema 版本化并可迁移 | 独立 `templateVersion`、`schemaVersion`、migration 003 回填和兼容测试。 |

[VERIFIED: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`]

## Project Constraints (from AGENTS.md)

- 这是独立平台项目，不得宣称尚未实现的多项目模块/AI 能力已经完成。[VERIFIED: `AGENTS.md`]
- 平台—项目—作战单元三级结构必须保留。[VERIFIED: `AGENTS.md`]
- 固定模块渲染，项目差异只通过数据、模板、术语和主题配置表达。[VERIFIED: `AGENTS.md`]
- `xugu-agentic-group` 数据与视觉迁移不可丢失，参考项目保持只读。[VERIFIED: `AGENTS.md`]
- 实现后必须执行 `npm run verify`，并追加 API、浏览器、迁移和安全验证；同时更新 RESULT/PROCESS/STATE/HANDOFF，架构边界变化时更新 DECISIONS。[VERIFIED: `AGENTS.md`]
- 不提交 API Key、运行数据库、上传原件、预处理材料、日志或临时交付物；保护其他人的未提交修改。[VERIFIED: `AGENTS.md`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| 模块/模板注册与版本校验 | API / Backend | Database / Storage | 服务端必须拒绝未知类型、版本和固定视图变体；数据库只持久化被验证的数据配置。 |
| 模板与模块实例持久化 | Database / Storage | API / Backend | `templates` 与按 `version_id` 的 `project_modules` 已是版本边界。 |
| 模块数据读模型 | API / Backend | Database / Storage | loader 从规范化表组合稳定 DTO，避免浏览器解释存储细节。 |
| 固定模块渲染 | Browser / Client | API / Backend | 浏览器从本地 renderer map 选择固定组件，只消费已校验 DTO。 |
| 主题、术语、Banner 与模块文案 | API / Backend | Browser / Client | 服务端解析模板+项目预设，浏览器应用 allowlist token 和文本。 |
| Xugu 视觉回归 | Browser / Client | API / Backend | 视觉由固定组件负责，事实与顺序由 Xugu 发布态读模型提供。 |

[VERIFIED: current architecture and accepted decisions; architecture recommendation]

## Standard Stack

### Core

| Library / Runtime | Version | Purpose | Why Standard Here |
|---|---:|---|---|
| Node.js | `>=24.15` | HTTP、校验、模块读模型、测试 | 项目已锁定 Node 24.15+，当前机器为 v25.9.0。 |
| `node:sqlite` `DatabaseSync` | Node built-in | migration 003、模板/模块读取 | D-007 已接受，避免引入数据库驱动。 |
| 原生 ES modules + DOM APIs | repository-local | 固定 renderer、路由与交互 | Phase 2 已验证，无远程 registry/CDN。 |
| `node:test` | Node built-in | 单元、迁移、API、隔离测试 | 当前 30 项测试与 `npm run verify` 均基于此。 |

[VERIFIED: `package.json`, D-007/D-010, environment probe]

### Supporting

| Tool | Version | Purpose | When to Use |
|---|---:|---|---|
| npm | 11.12.1 installed | 统一脚本入口 | `npm run verify`；本阶段不安装新包。 |
| SQLite JSON functions | Node-bundled SQLite | 配置 JSON 有效性与有限字段读取 | 只用于存储/查询，完整业务校验仍由服务层执行。 |

[VERIFIED: environment probe, `001_initial.sql`]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| 本地固定 renderer map | 前端框架/远程组件 registry | 增加依赖和可执行边界，且与 D-010 的本地固定组件方向不符。 |
| 规范化实体 + 模块 DTO | 每个模块塞一份完整 `data_json` | 会复制任务/路线事实并产生漂移，违背 DATA-02 的独立实体方向。 |
| migration 003 回填 | 修改 `001_initial.sql` | 会破坏已应用 migration 的校验和不变量。 |

[VERIFIED: D-003/D-010, DATA-02, current migration checksum tests]

**Installation:** 不新增外部 package；继续使用现有 `npm install` 空依赖状态。[VERIFIED: `package.json`; recommendation]

## Package Legitimacy Audit

本阶段不建议安装外部包，因此 Package Legitimacy Gate 不适用。[VERIFIED: recommended stack]

## Architecture Patterns

### System Architecture Diagram

```text
GET /api/projects/:projectId/public/modules/:moduleType
        │ authenticated principal + uniform project authorization
        ▼
server module registry (allowlisted type/schema/view)
        │
        ├── template resolver ── templates(id, version, config_json)
        ├── module resolver ──── project_modules(version_id, enabled, position)
        └── data loader ──────── normalized project_* tables
        │
        ▼
versioned module envelope (plain JSON; no HTML/component/code)
        │
        ▼
browser renderer map[module.type]
        │ fixed DOM/SVG/CSS component + project theme/terminology tokens
        ▼
Xugu-aligned or standard-project fixed view variant
```

[VERIFIED: existing tiers; architecture recommendation]

### Recommended Project Structure

```text
src/
├── modules/
│   ├── registry.mjs          # nine allowlisted definitions
│   ├── schemas.mjs           # versioned contract constants + targeted validators
│   ├── loaders.mjs           # normalized DB -> module DTO
│   └── module-service.mjs    # auth-independent orchestration
├── templates/
│   ├── catalog.mjs           # campaign-map-v1 + standard-project-v1 manifests
│   └── template-validator.mjs
├── db/migrations/003_module_registry_templates.sql
public/
├── modules/
│   ├── registry.js           # type -> fixed renderer
│   ├── overview.js ... materials.js
│   └── shared.js             # safe DOM helpers, empty/error states
└── app.js                    # shell/routing only
test/
├── module-registry.test.mjs
├── module-api.test.mjs
├── template-catalog.test.mjs
└── module-ui-server.test.mjs
```

[VERIFIED: current structure; architecture recommendation]

### Pattern 1: Server Registry Owns the Contract

```js
// Source: repository architecture recommendation derived from D-003/D-010
export const moduleRegistry = Object.freeze({
  roadmap: Object.freeze({
    schemaVersion: "1.0.0",
    loader: loadRoadmap,
    allowedViews: Object.freeze(["campaign-network", "linear-roadmap"])
  }),
  gantt: Object.freeze({
    schemaVersion: "1.0.0",
    loader: loadGantt,
    allowedViews: Object.freeze(["branching", "lanes"])
  })
});
```

不要从数据库读取函数名、模块路径或组件名；数据库只保存 `moduleType`、`schemaVersion`、启停、顺序和 allowlist 中的 `viewVariant`。[VERIFIED: security boundary; architecture recommendation]

### Pattern 2: Stable Module Envelope

```js
// Source: repository API pattern + Phase 3 recommendation
{
  projectId: "xugu-agentic-group",
  layer: "published",
  version: "v4.2",
  template: { id: "campaign-map-v1", version: "1.0.0" },
  module: {
    type: "roadmap",
    schemaVersion: "1.0.0",
    position: 2,
    enabled: true,
    title: "战役路线",
    viewVariant: "campaign-network"
  },
  data: { stages: [], closures: [], workstreams: [] }
}
```

`projectId`、layer、项目版本、模板版本和模块 schema 版本必须同时返回，使客户端拒绝错误缓存或未知契约。[VERIFIED: NFR-04 and project isolation requirement; recommendation]

### Pattern 3: Fixed Client Renderer Map

```js
// Source: Phase 2 safe DOM helper pattern + Phase 3 recommendation
const renderers = Object.freeze({
  overview: renderOverview,
  units: renderUnits,
  roadmap: renderRoadmap,
  "task-network": renderTaskNetwork,
  gantt: renderGantt,
  outcomes: renderOutcomes,
  risks: renderRisks,
  metrics: renderMetrics,
  materials: renderMaterials
});

const render = renderers[payload.module.type];
if (!render) throw new Error("UNSUPPORTED_MODULE_TYPE");
container.replaceChildren(render(payload));
```

所有项目文本通过现有 `element(..., { text })`/`textContent` 创建；SVG 路径由固定 renderer 计算，不能接受项目提供的 SVG/HTML 字符串。[VERIFIED: current `public/app.js` safe helper; security recommendation]

## Nine Module Schemas / Registry

所有模块共享 envelope：`type`、`schemaVersion`、`enabled`、`position`、`titleTerm`、`viewVariant`、`emptyStateTerm`；`type/schemaVersion/viewVariant` 为注册表 allowlist，`position` 为同一版本内唯一的非负整数。[VERIFIED: current `project_modules`; recommendation]

| Type | v1 Data Contract | Normalized Source | Fixed Views / Key Validation |
|---|---|---|---|
| `overview` | `goal, summary, statusLabel, currentStageId, overallProgress?, facts[]` | version metadata + counts | `mission-status`; progress 可为 null，不得推导或补造。 |
| `units` | `units[{id,name,short?,owner?,objective?,currentWork?,expectedOutput?,source?}]` | `project_units` | `campaign-cards`, `team-cards`; stable ID 唯一。 |
| `roadmap` | `stages[]`, `closures[]`, `workstreams[]`, `currentStageId?` | stages/closures/workstreams | `campaign-network`, `linear-roadmap`; closure 的 `between[]` 必须引用已存在 stage；任意数量节点均需布局，不能依赖固定 6 节点坐标。 |
| `task-network` | `units[]`, `nodes[{id,unitId,parentId?,title,owner?,state?}]`, `edges[{from,to,kind}]` | units/tasks/task_links | `branching-network`, `dependency-list`; 禁止自环、悬空引用和循环。 |
| `gantt` | `range{start?,end?}`, `lanes[{unitId,taskIds[]}]`, `tasks[{id,title,startDate?,endDate?,progress?,dependencyIds[]}]`, `unscheduledIds[]` | units/tasks/task_links | `branching`, `lanes`; ISO 日期有值时 start ≤ end；无日期进入 unscheduled，不能虚构时间。 |
| `outcomes` | `outcomes[{id,title,dateLabel?,state,description?,result?,source?,previewAssets[]}]` | Phase 3 先映射 closures；后续可迁移独立 outcome entity | `archive-grid`, `closure-detail`; preview 只接受本地/服务端受控 asset reference，不接受 URL/HTML。 |
| `risks` | `risks[{id,title,severity,status,owner?,mitigation?,dueDate?,source?}]` | migration 003 新增 `project_risks` | `risk-register`; severity/status 枚举，空数据明确“暂无已登记风险”，不等于无风险。 |
| `metrics` | `metrics[{id,name,value?,unit?,status,asOf?,target?,source?}]` | migration 003 新增 `project_metrics` | `metric-cards`; null value 显示待补充，不把计划 target 当事实 value。 |
| `materials` | `summary{count,readyCount?}`, `items[]` | Phase 3 无材料实体 | `materials-empty`; 本阶段固定返回不可操作空状态，Phase 4 再接项目级材料仓储。 |

[VERIFIED: requirements, current normalized entities, Xugu fixture/app; schema recommendation]

`outcomes` 采用兼容投影而不复制 closure 数据；风险/指标需要独立实体，因为 DATA-02 禁止把所有业务事实塞入模块 JSON。[VERIFIED: DATA-02, current schema; recommendation] `project_modules.data_json` 只允许视图设置，例如 `{ "schemaVersion":"1.0.0", "viewVariant":"campaign-network" }`，不得成为模块事实仓库。[VERIFIED: architecture recommendation]

## Template Contracts

模板 manifest 必须包含 `id/version/name`、`terminology`、`themePreset`、`fields`、`statuses`、`validation`、`defaultView`、`modules[]`；每个模块项只可引用注册表已知 type/schema/view，且模板版本一经被项目引用不得原地修改。[VERIFIED: TPL-01/NFR-04; recommendation]

### `campaign-map-v1@1.0.0`

- 术语：作战总览、作战单元、行动任务、战役节点、战果闭环/战果档案、公司级战线。[VERIFIED: D-012, Xugu fixture/app]
- 主题：`xugu-blue`；桌面保持 Xugu 白头部、暖色背景、蓝结构、暖橙当前节点。[VERIFIED: D-011, Phase 2 UI-SPEC]
- 固定视图：roadmap=`campaign-network`，task-network=`branching-network`，gantt=`branching`，outcomes=`closure-detail`。[VERIFIED: reference Xugu app/evidence; recommendation]
- 默认顺序：overview, roadmap, units, task-network, gantt, outcomes, risks, metrics, materials；九项均创建，缺数据模块显示诚实空状态。[VERIFIED: MOD-01 and Xugu navigation; recommendation]

### `standard-project-v1@1.0.0`

- 术语：项目总览、团队、任务、里程碑、交付物、工作流。[VERIFIED: D-012, Phase 2 `projectPresentation`]
- 主题：`neutral-blue`；仍使用同一 Xugu 桌面骨架，不建立另一套 SaaS 壳。[VERIFIED: D-011/D-012]
- 固定视图：roadmap=`linear-roadmap`，task-network=`dependency-list`，gantt=`lanes`，outcomes=`archive-grid`。[VERIFIED: recommendation]
- 默认顺序同九类基础模块；新建摘要继续用“团队、任务、里程碑”，不得出现“作战单元/战役路线”。[VERIFIED: Phase 2 verified behavior]

### Module Enable/Disable and Ordering

- 每个 published/draft 版本各有九条 `project_modules`，`external_id` 固定等于 type；同一版本 `(position)` 增加唯一约束，位置必须规范化为 `0..n-1`。[VERIFIED: existing schema; recommendation]
- `overview` 为两模板必填且不可禁用；模板可再声明必填模块。禁用只影响导航和模块端点可见性，不删除实体数据。[VERIFIED: TPL-01; recommendation]
- 新项目创建时 published/draft 从模板复制相同模块配置，之后两层配置独立演进。[VERIFIED: existing separate version graph; recommendation]
- Phase 3 若提供排序/启停写接口，只允许写 `draft`，使用项目管理员/编辑者权限与 CSRF；public 仍读 published。不得为了“立即可见”同时改两层。[VERIFIED: published/draft boundary and Phase 2 auth; recommendation]
- 批量更新使用一个事务，服务端接收完整 ordered list，验证九类集合、重复、必填模块和 allowlist 后整体替换；失败不得部分改变。[VERIFIED: NFR-02 and transaction pattern; recommendation]

## API Contract

保留现有 `GET /api/projects/:projectId/public` 作为壳/概览兼容入口；新增以下规范接口。[VERIFIED: current API; recommendation]

```text
GET /api/projects/:projectId/public/modules
GET /api/projects/:projectId/public/modules/:moduleType
GET /api/projects/:projectId/draft/modules
GET /api/projects/:projectId/draft/modules/:moduleType
PATCH /api/projects/:projectId/draft/modules   # optional Phase 3 configuration UI
```

- 每条路由先调用现有统一授权查询，再解析层指针和模块；未知、越权、归档项目继续统一 404，禁用模块返回 404，未知 module type 不泄露注册表内部信息。[VERIFIED: Phase 2 authorization contract; recommendation]
- 列表端点返回已排序 manifest 和已解析 `title/emptyState/viewVariant`，详情端点返回 stable envelope + module DTO。[VERIFIED: recommendation]
- 路线、任务网络和甘特必须共用同一 version snapshot；响应不可跨 version 拼接，否则会出现路线/任务/日期不一致。[VERIFIED: normalized version model; recommendation]
- API 不返回 `rendererKey`、文件路径、SQL、HTML 或任意可执行配置。[VERIFIED: MOD-02; recommendation]

## Migration Strategy

1. 新增 `003_module_registry_templates.sql`，绝不修改 001/002。[VERIFIED: migration checksum invariant]
2. 为 `project_modules` 回填 `schemaVersion/viewVariant` 到受限配置，并增加 `(version_id, position)` 唯一索引；先检测重复位置再建索引。[VERIFIED: existing data shape; recommendation]
3. 插入/升级两个模板 manifest；保留项目当前 `(template_id, template_version)`，同版本 manifest 必须与代码 catalog 校验一致。[VERIFIED: NFR-04; recommendation]
4. 新增版本归属的 `project_risks` 与 `project_metrics` 独立表，均带 `(version_id, external_id)` 主键、position 与 JSON 扩展字段校验；不要提前建立材料表。[VERIFIED: DATA-02, Phase boundaries; recommendation]
5. 对 `xugu-agentic-group` 的 published/draft 各回填九模块配置，不改任何 units/stages/closures/tasks/links/workstreams 事实。[VERIFIED: migration preservation requirement]
6. 导入/导出兼容层继续产生与 fixture 深度语义等价的旧 snapshot；模块 manifest 可作为新 API 元数据，不应污染旧 fixture 导出。[VERIFIED: current semantic equivalence test; recommendation]
7. 新建标准项目通过模板 catalog 创建空 published/draft、九模块 manifest 和诚实空状态；不得调用 Xugu 专用迁移语义来生成文案。[VERIFIED: Phase 2 creation behavior; recommendation]

## Visual Migration and Regression

- 迁移固定结构而非复制旧 `innerHTML` 模板：将路线、任务网络、甘特的算法与视觉语义重写为安全 DOM/SVG renderer，项目文本全部经 `textContent`。[VERIFIED: reference Xugu uses template strings; MOD-02 recommendation]
- Xugu route renderer 必须处理任意节点数量；旧应用的 `roadPositions`/`roadPoints` 与 2026-07 至 2027-01 甘特范围是项目特定硬编码，不能进入通用契约。[VERIFIED: reference `app.js`]
- `campaign-map-v1` 保留曲线路线、蓝/橙当前节点、分支汇合、战线卡、分层甘特和无日期任务的虚线空档；`standard-project-v1` 用同一视觉 token 的线性/泳道变体。[VERIFIED: reference evidence and Phase 2 UI-SPEC; recommendation]
- 视觉验收最少覆盖：项目壳、九模块导航、Xugu 路线、单元任务网络、甘特、成果详情，以及标准项目的同位置页面。[VERIFIED: Phase 3 scope; recommendation]
- 每次验收前后记录参考仓库 HEAD、`git status --short` 和 seed SHA-256；当前观察到 HEAD `97cb1ebf...`，平台 fixture 与参考 seed 均为 `b134f549...`。[VERIFIED: read-only probes on 2026-07-18]
- 桌面 1440×900 为主对照，继续验收 1024×768、390×844 无水平页面溢出；路线/甘特内部允许带可访问说明的局部横向滚动。[VERIFIED: Phase 2 acceptance; recommendation]
- 不建议仅用像素阈值判定：同时断言 76px 白头部、Hero 双栏、暖色 canvas、模块顺序/文案、节点/边/任务条数量和关键色 token，再保存并人工并排检查截图。[VERIFIED: Phase 2 visual contract; recommendation]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| 任意低代码页面 | DB/项目提供组件路径、HTML/CSS/JS | 九类本地固定 renderer map | 防止项目数据成为执行入口。 |
| 第二份业务事实 | 把全部 tasks/stages 写入 module `data_json` | 规范化表 + loader DTO | 避免事实漂移和跨版本拼接。 |
| 图数据校验 | 仅靠浏览器画不出来才报错 | 服务端 ID/引用/日期/DAG 确定性校验 | 失败应在持久化/响应前确定发生。 |
| Xugu 固定坐标泛化 | 固定 6 节点、固定 7 组、固定 2026 月份 | 由数组长度/日期范围计算布局 | 第二个项目数量与日期不同。 |
| 发布捷径 | 启停/排序同时写 published 与 draft | draft-only mutation + 后续 Phase 6 发布 | 保持层级边界。 |
| “智能”完成率 | 从任务数/日期推导项目进度 | null + 明确待补充 | 计划不能冒充事实。 |

[VERIFIED: current/reference code and accepted constraints; recommendations]

## Common Pitfalls

### 1. 三份模板真相继续漂移
**What goes wrong:** service、迁移器、前端各自维护模板/术语/模块数组。[VERIFIED: current code]
**How to avoid:** 服务端 catalog 负责定义与校验，API 返回解析值；前端只保留 renderer 函数，不重复模板业务文案。[VERIFIED: recommendation]

### 2. 模块启停删除事实
**What goes wrong:** 禁用模块时删除 tasks/stages，重新启用后数据丢失。[VERIFIED: risk inference]
**How to avoid:** `enabled` 仅控制 manifest/导航/端点，实体数据保持原样。[VERIFIED: recommendation]

### 3. 路线与甘特沿用 Xugu 硬编码
**What goes wrong:** 标准项目不是 6 节点或不在 2026 下半年时布局错误。[VERIFIED: reference `roadPositions` and `taskMonthPosition`]
**How to avoid:** API 提供结构与真实日期，renderer 按数据计算范围、lane 和坐标；无日期单列。[VERIFIED: recommendation]

### 4. Template version 被原地改写
**What goes wrong:** 老项目不迁移却突然获得新语义/校验。[VERIFIED: NFR-04 risk]
**How to avoid:** manifest 不可变；变更创建新版本并显式迁移项目指针和模块 schema。[VERIFIED: recommendation]

### 5. 安全渲染退化
**What goes wrong:** 为复刻旧页面复制字符串模板并插入项目内容，形成 XSS/代码注入面。[VERIFIED: reference app uses HTML templates; risk inference]
**How to avoid:** 固定 DOM builder、`textContent`、URL/asset allowlist、禁止 `innerHTML` 接收项目数据。[VERIFIED: current Phase 2 safe helper; recommendation]

### 6. 空数据被展示成“零风险/零材料已完成”
**What goes wrong:** 用户误把未录入理解为确认不存在。[VERIFIED: product truthfulness constraint]
**How to avoid:** 风险/指标/材料使用“暂无已登记/待补充/Phase 4 开放”的明确状态，不产生完成结论。[VERIFIED: recommendation]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node built-in `node:test` on Node >=24.15 |
| Config file | none |
| Quick run | `node --test test/module-registry.test.mjs test/template-catalog.test.mjs` |
| Full suite | `npm run verify` |

[VERIFIED: current project tests and config]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| MOD-01 | 九种 type 均有 schema/loader/renderer/empty state | unit | `node --test test/module-registry.test.mjs` | ❌ Wave 0 |
| MOD-02 | 未知 type/view 拒绝；项目文本不进入 executable HTML | unit + HTTP/static | `node --test test/module-ui-server.test.mjs` | ❌ Wave 0 |
| TPL-01 | manifest 必填字段、状态、术语、主题、默认视图校验 | unit | `node --test test/template-catalog.test.mjs` | ❌ Wave 0 |
| TPL-02 | Xugu template 产生 campaign 术语/顺序/视图 | migration + API | `node --test test/module-api.test.mjs` | ❌ Wave 0 |
| TPL-03 | 标准项目创建后九模块完整且无 Xugu 文案 | integration | `node --test test/module-api.test.mjs` | ❌ Wave 0 |
| NFR-04 | migration 003 repeat/checksum/backfill；未知版本拒绝 | migration | `node --test test/db-foundation.test.mjs test/module-registry.test.mjs` | partial |

[VERIFIED: requirements and test inventory; recommendation]

### Required Negative/Security Tests

- 两个项目、两种角色、public/draft、九模块的矩阵必须证明 URL、module payload、术语和模板版本不串项目。[VERIFIED: AUTH-02; recommendation]
- 未知/禁用 module、未知 view/schema、重复 position、缺必填模块、悬空/循环 task edge、closure stage 引用、逆序日期均确定性拒绝。[VERIFIED: schema risks; recommendation]
- 含 `<script>`, event handler, `javascript:` URL, SVG/HTML 字符串的项目字段只能作为文本或被 URL allowlist 拒绝。[VERIFIED: MOD-02; recommendation]
- migration/import 失败必须回滚；Xugu 导出继续与 fixture 深度相等，7 units/29 tasks/6 stages/2 closures/4 workstreams 不变。[VERIFIED: current baseline; recommendation]
- `/api/public` 兼容入口继续返回 Xugu published snapshot，不承载新项目模块路由。[VERIFIED: current compatibility contract; recommendation]

### Sampling Rate

- **Per task commit:** 对应新增的单测文件 + `node --check` 修改过的 JS/MJS。[VERIFIED: existing validation style]
- **Per wave merge:** `node --test`。[VERIFIED: existing validation style]
- **Phase gate:** `npm run verify` + 双项目真实浏览器矩阵 + 参考仓库只读复核。[VERIFIED: AGENTS lifecycle]

### Wave 0 Gaps

- [ ] `test/module-registry.test.mjs`
- [ ] `test/template-catalog.test.mjs`
- [ ] `test/module-api.test.mjs`
- [ ] `test/module-ui-server.test.mjs`
- [ ] migration 003 repeat/checksum/backfill fixture
- [ ] browser capture checklist for Xugu + standard project

[VERIFIED: current test inventory]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---:|---|
| Node.js | runtime/tests | ✓ | 25.9.0 | project minimum 24.15 |
| npm | scripts | ✓ | 11.12.1 | direct `node` commands |
| `node:sqlite` | persistence | ✓ via installed Node | Node-bundled | none needed |
| external package | none | n/a | n/a | no install proposed |

[VERIFIED: local environment probe, `package.json`]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes, unchanged | existing server session resolution |
| V3 Session Management | yes, unchanged | HttpOnly SameSite=Strict cookie + expiry |
| V4 Access Control | yes | re-use project authorization before module/version resolution; uniform 404 |
| V5 Input Validation | yes | type/schema/view allowlists, targeted schema validators, stable IDs, graph/date checks |
| V6 Cryptography | no new control | no cryptography added in Phase 3 |

[VERIFIED: Phase 2 security implementation and Phase 3 threat surface]

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| 项目数据选择 renderer/代码路径 | Elevation of Privilege | fixed map; reject unknown type/view; never import from data |
| 跨项目模块读取 | Information Disclosure | authorize project first; resolve version by same project ID |
| HTML/SVG/URL 注入 | Tampering / XSS | DOM text APIs; asset URL allowlist; CSP remains enabled |
| 模块配置部分写入 | Tampering | transaction + complete-list validation |
| 模板版本静默漂移 | Tampering / Repudiation | immutable versions + migration + audit-ready metadata |

[VERIFIED: accepted security boundaries; threat analysis]

## State of the Art

| Old / Current Approach | Phase 3 Approach | Impact |
|---|---|---|
| 三处硬编码模板与模块字符串 | versioned catalog + registry + resolved API | 单一契约，减少漂移。 |
| `/public` 一次返回完整 snapshot | shell兼容 + per-module DTO | 可按模块加载、缓存与测试。 |
| 未来模块禁用占位 | 九种固定 renderer + 诚实空状态 | 满足 MOD-01，仍不提前实现 Phase 4–6。 |
| Xugu 固定节点/月范围 | data-driven fixed variants | 第二项目无需改页面代码。 |

[VERIFIED: current code vs recommendation]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | 风险和指标在 migration 003 建立独立表，而不是延迟到后续阶段。 | Nine Module Schemas | 若产品只要求只读空模块，本阶段工作量可减少；但完整 Schema 与 DATA-02 更支持现在建表。 |
| A2 | Phase 3 可选提供 draft-only 模块排序/启停写接口。 | API Contract | 若阶段只要求模板默认配置，可把写 UI/API 延后，但创建/读取/验证仍必须完成。 |

以上为规划取舍而非已锁定事实，已明确标记。[ASSUMED]

## Open Questions

1. **Phase 3 是否必须交付模块启停/排序的管理 UI？**
   - 已知：需求明确要求模板定义启停与排序，且现有 DB 已按版本保存配置。[VERIFIED: roadmap/schema]
   - 建议：计划至少实现 repository/service/API 与创建时默认值；若加入 UI，只写 draft，不突破 Phase 6 发布边界。[ASSUMED]
2. **风险/指标实体是否在本阶段落库？**
   - 已知：MOD-01 要完整模块，DATA-02 要独立实体；当前没有对应表。[VERIFIED: requirements/schema]
   - 建议：本阶段建立最小规范化表和空状态，不实现材料/AI 证据工作流。[ASSUMED]

## Sources

### Primary (HIGH confidence)

- `AGENTS.md`, `.planning/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `DECISIONS.md`, `STATE.md`, `docs/RESULT.md`, `AI-SPEC.md` — accepted constraints and phase scope.
- Phase 2 `UI-SPEC.md`, `VERIFICATION.md`, `02-VALIDATION.md` — verified shell, terminology, security and browser baseline.
- `src/db/migrations/001_initial.sql`, repositories, services, migration, HTTP and browser code — current schema/API seams.
- `fixtures/projects/xugu-agentic-group.json` and reference Xugu `app.js`, `styles.css`, docs/evidence — migration facts and visual semantics; reference read only.

### Secondary (MEDIUM confidence)

- None. External documentation seam and `gsd-tools` were unavailable in this environment; no external package/API recommendation was required.[VERIFIED: environment discovery]

### Tertiary (LOW confidence)

- Assumptions A1–A2 only.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked and installed stack, no package change.[VERIFIED: package/environment]
- Architecture: HIGH — extends existing normalized/versioned seams and accepted fixed-renderer boundary.[VERIFIED: schema/code/decisions]
- Schemas/API: MEDIUM — implementation-ready recommendation, with two explicitly logged scope assumptions.[ASSUMED]
- Pitfalls/security: HIGH — observed current/reference hardcoding and established Phase 2 controls.[VERIFIED: code/tests]

**Research date:** 2026-07-18  
**Valid until:** 2026-08-17 (stable local architecture; re-check if Phase 3 decisions or schema change).[ASSUMED]
