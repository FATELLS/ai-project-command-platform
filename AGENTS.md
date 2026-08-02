# AI 项目作战管理平台：Agent 工作规则

本文件适用于整个新项目。任何人员或 Agent 在设计、规划、编码、测试或交接前必须先阅读。

## 当前状态

- 本项目是独立的新平台项目，不是现有虚谷作战地图的结果目录。
- 当前只完成项目初始化、需求、架构、路线图和迁移夹具；不得宣称多项目平台已经实现。
- 现有稳定应用位于 `../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/`，默认只读，作为迁移来源和验收基线。

## 项目记忆

- 当前项目定义：`.planning/PROJECT.md`
- 需求：`.planning/REQUIREMENTS.md`
- 路线图：`.planning/ROADMAP.md`
- 当前状态：`.planning/STATE.md`
- 决策：`.planning/DECISIONS.md`
- 全项目系统设计：`.planning/design/system/README.md`
- 系统 SPEC：`.planning/design/system/SYSTEM-SPEC.md`
- 系统架构：`.planning/design/system/ARCHITECTURE.md`
- 需求追踪：`.planning/design/system/TRACEABILITY.md`
- 过程：`.planning/PROCESS.md`
- 交接：`.planning/HANDOFF.md`
- 已实现结果：`docs/RESULT.md`
- AI 设计契约：`AI-SPEC.md`

## 强制边界

- 平台管理多个项目；每个项目管理多个作战单元或团队。
- LLM 只能生成带来源的结构化 `ChangeProposal`，不得生成或执行页面代码。
- AI 不得直接写入 `published`，也不得绕过审核把内容合并到 `draft`。
- 固定模块渲染器负责页面；项目差异通过数据、模板、术语和主题配置表达。
- 当前虚谷项目必须以稳定 ID `xugu-agentic-group` 迁移，现有路线、任务、甘特和成果不得丢失。
- 项目、材料、问答、生成任务和权限必须按 `projectId` 隔离。

## 工作生命周期

1. 读取 `docs/RESULT.md` 和 `.planning/STATE.md`。
2. 读取当前阶段的需求、路线图和相关决策。
3. 新方向先写入 `.planning/PROCESS.md`，未经确认不得写成结果。
4. 实现后执行 `npm run verify` 和与风险相称的 API、浏览器、迁移与安全验证。
5. 更新 `docs/RESULT.md`、`.planning/PROCESS.md`、`.planning/STATE.md` 和 `.planning/HANDOFF.md`。
6. 架构边界变化时更新 `.planning/DECISIONS.md`。

## 强制留痕与 Agent 交接（不可省略）

> **任何 Agent 在结束当前会话之前，必须完成以下全部步骤。** 未完成的会话视为未完成工作。
> 这是保证 Agent 切换不丢上下文的唯一机制。

### 1. 每一步操作留痕

每次代码修改、配置变更、测试运行或架构决策，必须在**当次工具调用阶段**写入以下文件：

| 文件 | 写入时机 | 内容 |
|------|---------|------|
| `.planning/PROCESS.md` | 每次会话结束前 | 追加本次会话的讨论总结、做了什么、为什么这样做、遇到什么问题、怎么解决的 |
| `docs/RESULT.md` | 代码/功能变更后 | 更新已实现结果的对应章节 |
| `.planning/STATE.md` | 代码/功能变更后 | 更新当前平台状态（版本、测试基线、Git HEAD） |
| `.planning/HANDOFF.md` | 每次会话结束前 | 更新交接状态：下一个 Agent 需要知道什么、从哪里继续 |
| `.planning/DECISIONS.md` | 架构/设计决策变更时 | 追加 D-XXX 编号的决策记录 |
| `.workbuddy/memory/YYYY-MM-DD.md` | 每次会话结束前 | 追加简短日志（与 PROCESS.md 互补，更偏技术细节） |

### 2. 会话讨论总结

每次会话中有意义的讨论（用户提出的需求、方向性反馈、纠正性意见），**必须**总结后写入 `.planning/PROCESS.md`：

- 用户提出了什么需求/问题
- Agent 的分析和方案
- 用户认可或纠正了什么
- 最终决定了什么
- 未解决的问题和风险

格式：
```markdown
## YYYY-MM-DD 会话记录

### 讨论主题
（一句话概括）

### 用户需求
- ...

### Agent 分析与方案
- ...

### 用户反馈/纠正
- ...

### 最终决策
- ...

### 遗留问题
- ...
```

### 3. Agent 交接检查清单

当前会话结束前，确认以下文件均已更新：

- [ ] `.planning/PROCESS.md` — 本次会话讨论和操作的完整记录
- [ ] `.planning/HANDOFF.md` — 下一个 Agent 的起点（当前状态、下一步工作）
- [ ] `.planning/STATE.md` — 平台版本号、Git HEAD、测试基线
- [ ] `docs/RESULT.md` — 已实现结果（如有代码变更）
- [ ] `.planning/DECISIONS.md` — 新的架构决策（如有）
- [ ] `.workbuddy/memory/YYYY-MM-DD.md` — 当日工作日志

### 4. 新 Agent 接手流程

新 Agent 开始工作时，**必须按以下顺序读取**：

1. `AGENTS.md`（本文件）
2. `.planning/HANDOFF.md` — 最新的交接状态
3. `.planning/STATE.md` — 平台当前状态
4. `.planning/PROCESS.md` 最近 3 条记录 — 近期工作脉络
5. `docs/RESULT.md` — 已实现结果
6. 根据任务需要，继续读取 ROADMAP / DECISIONS / REQUIREMENTS 等

**禁止**跳过上述步骤直接开始编码。

## Git 与安全

- 提交代码、Schema、模板、脱敏种子和过程文档。
- 不提交 API Key、运行数据库、上传原件、预处理材料、日志和临时交付物。
- 未配置开源许可证，默认仅供内部使用。
- 保护其他人的未提交修改；不得使用破坏性 Git 命令覆盖未知工作。
