# Phase 7 Verification

状态：`complete`

日期：2026-07-20

## 验收结果

- 材料关键内容覆盖已按六类更新模板计算 `ready / warning / blocked`，材料台账、材料详情和生成上下文均返回诊断；关键缺失会阻止生成任务进入 provider。
- 生成任务锁定材料时保存 readiness 快照，并把 `material_readiness` 放入模型上下文，便于后续审计材料当时是否足够。
- 作战单元支持 `active / archived / exited` 生命周期；新增、归档和退出只能作为带证据的 `ChangeProposal` 进入审核，删除作战单元被拒绝。
- 归档或退出作战单元必须提供生效日期、原因和证据；若仍存在未关闭任务，除非同一提案同步关闭/归档相关任务，否则合并前校验失败。
- HTTP 响应带 `x-request-id`；未知 5xx 写入脱敏 `error_events`，并关联 `operation_traces`、路由、用户、项目、状态、错误指纹和诊断包。
- 诊断 API 与产品内自检中心仅平台管理员或授权项目管理员可见；查看者返回统一 404。
- Materials 工作区新增“运维自检”入口，管理员可运行核心产品测试并查看历史运行和最近错误事件。

## 验证命令

```bash
npm test
npm run verify
```

结果：144 项自动化测试全部通过；统一验证通过迁移、语法、材料 readiness、作战单元生命周期、可观测性、产品自检、权限隔离、Phase 3–6 浏览器证据、Xugu 语义等价和参考项目只读校验。

## 浏览器抽查

- 本机服务：`http://127.0.0.1:4173`
- 登录后进入 `xugu-agentic-group` 的 Materials 模块，确认顶部项目文案仍为 Xugu Agentic Group Schedule 语义。
- 进入“运维自检”，点击“运行核心自检”，页面返回 `core · passed` 与 `5/5 通过`。

## 边界确认

- AI 仍不能写入 `draft` 或 `published`，也不能执行页面代码。
- 材料 readiness 只影响生成准入与提示，不自动改变项目事实。
- 作战单元生命周期变化保留历史事实，不物理删除单位。
- 诊断包会脱敏 Cookie、CSRF、密钥、材料正文和模型提示词。
