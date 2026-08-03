# AI 项目作战管理平台：Agent 工作规则

本文件适用于整个工程。任何人员或 Agent 在设计、编码、测试或交接前必须先阅读。

## 当前状态

- 当前版本为 `1.0.0`，代码、迁移、测试和发布设计采用单一虚谷数据库后端。
- 平台管理多个项目，每个项目管理多个作战单元或团队。
- 现有稳定参考应用位于 `../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/`，默认只读。
- 产品运行栈包括 Node 应用、虚谷 Docker 实例、材料存储、迁移、备份恢复和 portable 发布包。

## 项目记忆

- 项目定义：`.planning/PROJECT.md`
- 需求：`.planning/REQUIREMENTS.md`
- 路线图：`.planning/ROADMAP.md`
- 状态：`.planning/STATE.md`
- 决策：`.planning/DECISIONS.md`
- 系统设计：`.planning/design/system/README.md`
- 过程：`.planning/PROCESS.md`
- 交接：`.planning/HANDOFF.md`
- 已实现结果：`docs/RESULT.md`
- AI 契约：`AI-SPEC.md`

## 强制边界

- 虚谷是唯一数据库；不得引入第二套持久化实现、迁移树或测试后端。
- `project_cards` 与 `project_card_links` 是版本化项目图唯一读写模型。
- LLM 只能生成带来源的结构化 `ChangeProposal`，不得生成或执行页面代码。
- AI 不得直接写入 `draft` 或 `published`，也不得绕过人工审核。
- 固定模块 renderer 负责页面；项目差异通过数据、模板、术语和主题表达。
- `xugu-agentic-group` 是虚谷项目的稳定 ID，路线、任务、甘特和成果不得丢失。
- 项目、材料、证据、问答、生成任务、审核和权限必须按 `projectId` 隔离。
- 默认生命周期由平台管理器按“虚谷后应用”启动、按“应用后虚谷”停止；外部共享实例必须显式配置为 `external`，平台不得误停。
- 配置只经过 `src/config/local-config.mjs`；密钥只存未跟踪配置或运行数据库，API 响应、日志和诊断必须脱敏。

## 工作生命周期

1. 依次读取 `AGENTS.md`、`.planning/HANDOFF.md`、`.planning/STATE.md`、`.planning/PROCESS.md` 最近记录和 `docs/RESULT.md`。
2. 读取任务相关需求、决策与 canonical design。
3. 新方向先记录到 `.planning/PROCESS.md`，确认后才进入结果文档。
4. 实现后执行 `npm run verify`，并按风险补充真实虚谷、浏览器、迁移、恢复和安全验证。
5. 更新结果、状态、过程、交接和当日 memory；架构变化同时更新决策。

## 强制留痕

每次会话结束前必须更新：

- `.planning/PROCESS.md`：用户要求、分析、修改、测试、风险和最终决定。
- `.planning/HANDOFF.md`：下一个 Agent 的准确起点。
- `.planning/STATE.md`：版本、Git HEAD、测试基线和下一步。
- `docs/RESULT.md`：仅记录已实现且已验证的能力。
- `.planning/DECISIONS.md`：新增或变化的架构决策。
- `.workbuddy/memory/YYYY-MM-DD.md`：简短技术日志。

## Git 与安全

- 提交代码、虚谷 Schema、模板、脱敏种子和过程文档。
- 不提交 API Key、运行卷、上传原件、预处理材料、日志和临时交付物。
- 仓库未开放授权，`package.json` 必须保持 `private` 与 `UNLICENSED`。
- 保护未知未提交修改，不得使用破坏性 Git 命令覆盖他人工作。
