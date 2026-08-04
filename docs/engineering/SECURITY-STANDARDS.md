# Security Standards

> Authority: constitution C-04, C-13, REFACTOR-PLAN §6.8

---

## 1. 认证和授权

- 认证基于 session cookie（httpOnly, secure, sameSite=lax）
- 密码使用 bcrypt（cost ≥ 12）
- 每个请求必须通过 Fastify auth plugin 验证
- 管理操作需要显式角色检查

## 2. 项目隔离

- 所有业务数据查询必须包含 `WHERE project_id = $projectId`
- 跨项目访问返回 **404**（not-found 语义），不泄露资源存在性
- 权限检查在 service 层执行，不依赖前端隐藏

## 3. 输入验证

- 所有 HTTP 输入通过 JSON Schema 验证（Fastify schema validation）
- 文件上传检查 MIME type、文件大小、文件名
- SQL 参数化（Kysely 自动参数化），禁止字符串拼接 SQL
- 环境变量在启动边界解析和类型验证

## 4. 密钥管理

- 密钥只存未跟踪配置文件（`.env.local`）或运行时数据库
- **禁止**密钥进入：
  - 客户端代码
  - 日志
  - 错误消息
  - API 响应
  - Git 跟踪
  - 发布包
- API 响应中的配置信息必须脱敏（只显示 `isConfigured: boolean`）

## 5. 日志安全

- **禁止记录**：Authorization header、Cookie、API Key、数据库 URL、材料正文、完整 prompt、Provider 原始响应
- 日志字段：`requestId`、`projectId`、`durationMs`、`errorCode`（全部 `camelCase`）
- 运行日志与业务审计分离
- 审计事件使用点分名词：`project.published`、`material.uploaded`

## 6. 错误处理

- 错误结构固定：`{ "error": { "code", "message", "requestId", "details" } }`
- 错误消息不得包含：内部异常堆栈、SQL 语句、文件路径、凭据、供应商原始响应
- 未授权资源返回 not-found 语义

## 7. Git 安全

- **禁止提交**：`.api-keys*.json`、`.env.local`、`*.log`、`data/*`、`session-cookie.txt`、测试报告、诊断包
- `.gitignore` 必须包含以上规则
- `package.json` 必须保持 `private: true`、`license: UNLICENSED`
- CI artifact check 自动扫描

## 8. AI 安全

- LLM 只生成有来源的结构化 `ChangeProposal`
- AI 不直接写 draft/published
- AI 不审核、不发布、不执行代码
- AI Provider 调用超时必须有 fallback 和错误处理
- Provider 原始响应不得记录到日志

## 9. 依赖安全

- 定期运行 `npm audit`
- 新增依赖前检查许可证和安全公告
- 禁止引入已知有安全漏洞的依赖版本
