# Design S-08：Operations & Delivery

状态：`implemented baseline`

## Observability

### Request

- 接受格式合法的上游 request ID，否则生成 UUID。
- 每个 API 响应返回 `x-request-id`。
- 建立 operation trace，记录 operation/project/user/target/status。

### Error Event

保存：

- requestId/traceId。
- project/user。
- method/route/status/code。
- 脱敏 message/stack。
- stack fingerprint。
- 有界 context。

脱敏覆盖 Cookie、CSRF、authorization、API key、token、password、secret、prompt、messages 和正文。

### Diagnostic Bundle

按 error ID 或 requestId 聚合 error + traces。只有 platform admin 或授权 project admin 可访问；返回内容继续脱敏。

## Product Test Center

固定 catalog：

- material readiness。
- unit lifecycle。
- project isolation。
- release preview。
- observability。

用户只能触发 allowlist 测试套件，不能提交命令、文件路径或测试代码。结果持久化 run/case/status/duration/requestId。

## Backup and Restore

详见 Runtime Design：

- backup 使用 `VACUUM INTO`。
- quick_check、foreign_key_check、migration version。
- restore 前保留目标副本。
- 应用离线执行。

## Migration

- `legacy-project.mjs` 将脱敏 fixture 导入规范化表。
- 稳定项目 ID 为 `xugu-agentic-group`。
- 导入后对 units/tasks/stages/closures/workstreams 等做语义等价检查。
- 参考应用目录默认只读。

## Import and Export

- 导出不包含密钥、运行材料和日志。
- 导入要求显式模板并经过项目图校验。
- 不接受可执行资源。

## Packaging

目标：

- Windows x64 portable。
- Linux x64 tar/portable。
- RHEL 系 x64 RPM/systemd。

包内容通过运行白名单组装：

- server/runtime。
- `src` 运行代码。
- `public` 静态资源。
- migrations。
- 必需 package metadata。

明确排除：

- `.planning`、`test`、fixtures 默认数据。
- `.env*`。
- SQLite、uploads、logs、backups。
- Git metadata 和开发缓存。

## Deployment

- RPM 数据目录 `/var/lib/...`，配置 `/etc/...`。
- portable 数据位于明确运行目录。
- Secure Cookie 由 HTTPS 部署配置。
- `/health` 用于启动冒烟，不返回敏感状态。
- 源码后台实例由 `scripts/manage-server.mjs` 管理 PID、日志、健康检查和 SIGTERM；它不管理 Docker、虚谷或其他外部数据库服务。
- RPM 继续由 systemd 管理，Windows/Linux portable 继续使用各自的 Start/Stop 脚本，避免叠加第二个进程管理器。

## Release Verification

- 构建产物 SHA-256。
- 原生 runner 解包/安装。
- 启动服务。
- `/health` 成功。
- 源码生命周期测试覆盖 start/status/health/stop，并静态禁止数据库容器停止命令。
- 清单扫描无敏感路径。
- 默认空数据库，除非显式配置脱敏 fixture。

## Planned Operations Support

Phase 11 若新增 Provider connection test：

- 只返回 status、testedAt、latency、model、message、requestId。
- 不记录或返回密钥与原始 provider body。
- 不将测试成功当成永久在线状态。

## Verification

- requestId 和 error event。
- redaction patterns。
- role-gated bundle。
- product test allowlist。
- backup/restore。
- Xugu migration equivalence。
- packaging exclusion 和原生启动。
