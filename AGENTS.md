# AI 项目作战管理平台：Agent 工作规则

本文件适用于整个新项目。任何人员或 Agent 在设计、规划、编码、测试或交接前必须先阅读。

## 当前状态

- 本项目是独立的新平台项目，不是现有虚谷作战地图的结果目录。
- 当前只完成项目初始化、需求、架构、路线图和迁移夹具；不得宣称多项目平台已经实现。
- 现有稳定应用位于同级 `../xugu-ai-transformation-console/`，默认只读，作为迁移来源和验收基线。

## 项目记忆

- 当前项目定义：`.planning/PROJECT.md`
- 需求：`.planning/REQUIREMENTS.md`
- 路线图：`.planning/ROADMAP.md`
- 当前状态：`.planning/STATE.md`
- 决策：`.planning/DECISIONS.md`
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

## Git 与安全

- 提交代码、Schema、模板、脱敏种子和过程文档。
- 不提交 API Key、运行数据库、上传原件、预处理材料、日志和临时交付物。
- 未配置开源许可证，默认仅供内部使用。
- 保护其他人的未提交修改；不得使用破坏性 Git 命令覆盖未知工作。
