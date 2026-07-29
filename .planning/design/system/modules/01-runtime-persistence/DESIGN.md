# Design S-01：Runtime & Persistence

状态：`implemented baseline`

## Responsibilities

- 进程启动与优雅关闭。
- 数据库路径、打开参数、迁移和事务。
- SQLite dialect 和版本存储基础。
- 材料 worker 生命周期。
- 运行目录和打包路径解析。

## Runtime Lifecycle

```text
open database
  → apply migrations
  → optional fixture import
  → ensure bootstrap admin
  → build provider environment
  → start material worker
  → start HTTP server
```

关闭顺序为 `stop accepting requests → stop worker → close database`。

### Managed Source Runtime

| 操作 | 命令 | 行为 |
|---|---|---|
| 后台启动 | `npm run start:background` | 启动独立 Node 进程，写入 `server.pid`，等待 `/health` 成功 |
| 查询状态 | `npm run status` | 校验 PID 存活和 `/health` |
| 优雅停止 | `npm run stop` | 向已登记平台 PID 发送 SIGTERM，最多等待 20 秒 |
| 重启 | `npm run restart` | 完成优雅停止后重新后台启动 |

`npm start` 保留为前台开发入口，可用 `Ctrl+C` 触发相同关闭流程。后台管理器使用 `app.log`，路径可由 `PLATFORM_RUNTIME_PID_FILE` 和 `PLATFORM_RUNTIME_LOG_FILE` 覆盖。

生命周期所有权边界：

- 平台拥有 HTTP server、材料 worker 和自己建立的数据库连接。
- 平台不拥有 SQLite 文件之外的数据库服务进程，也不拥有虚谷 Docker 容器。
- `stop` 不执行 `docker stop/kill/rm`，不访问虚谷管理端口。
- 20 秒内未完成时返回失败并保留人工排查机会，不自动 SIGKILL。

## Database Rules

- 启用外键。
- 迁移在启动前应用，失败即退出。
- migration version 和 checksum 持久化。
- 仓储和 service 使用显式 SQL，不允许 UI 直接拼接查询。
- 多实体写入使用 `withTransaction` 或等价封装。
- 外部 ID 和内部 numeric version ID 分离。

## Ownership

| 数据 | 写入所有者 |
|---|---|
| users/sessions/projects/members | Identity & Project Access |
| version graph/modules/cards | Project Model / Change Control |
| materials/evidence/readiness | Materials & Evidence |
| generation/proposals | AI Services / Change Control |
| reviews/publications | Change Control |
| traces/errors/test runs | Operations |

模块可读其他模块的稳定投影，但不得直接写不属于自己的表，除非在已记录的跨模块事务服务中。

## Transaction Boundaries

- 创建项目：项目 + 初始 published/draft + 创建者成员关系。
- 保存提案：proposal + items + evidence relations。
- 合并：复制草稿 + 应用接受项 + 图校验 + 指针切换。
- 发布：新 published + 新 draft baseline + publication event + 指针。
- 回滚：新发布状态 + 新草稿 baseline + event。

## Worker

- 单 worker 轮询 queued material jobs。
- 领取任务时写 lease/state。
- 异常按 retryable/terminal 分类。
- 启动恢复遗留任务。
- 不允许 worker 直接创建 proposal 或发布版本。

## Backup and Restore

- backup：打开源库，`VACUUM INTO` 目标文件，运行 quick/foreign/migration 检查。
- restore：验证源备份，保留目标 pre-restore 副本，复制到临时文件，再原子 rename。
- 恢复要求应用离线。

## Evolution Triggers

以下任一情况出现时重新评估 PostgreSQL/多进程：

- 单 worker 吞吐无法满足明确 SLA。
- 需要多实例高可用。
- SQLite 写锁成为经测量瓶颈。
- 需要在线恢复或跨节点一致性。

## Verification

- migration checksum、外键、trigger 和版本指针测试。
- 事务失败注入不留部分数据。
- worker 重启恢复和重复领取测试。
- backup/restore quick check、foreign key 和 migration 基线测试。
