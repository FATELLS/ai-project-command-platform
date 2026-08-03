# Runtime & Persistence Design

## 职责

- 加载统一配置并定位应用资源。
- 管理虚谷连接、事务、迁移和同步业务接口。
- 管理专用 Docker 镜像、容器、volume 与应用生命周期。
- 提供项目材料目录与运行文件路径。

## 连接层

`openDatabase()` 只接受连接选项；传入文件路径会直接拒绝。`XuguDatabaseSync` 暴露 `prepare/get/all/run/exec` 和事务接口。

原生驱动运行在 `xugu-worker.cjs`：

- Worker 独占连接并使用官方 callback API。
- SharedArrayBuffer 只传输序列化结果，不传输密钥。
- CLOB 与 typed array 按 UTF-8 转换。
- 结果缓冲区上限 32 MiB，超限明确失败。
- 初始化失败立即终止 Worker，避免冷启动重试泄漏线程。
- 正常关闭执行 disconnect；异常会话可直接 discard，但事务中禁止重连。

## 迁移

`applyMigrations()` 按文件名前缀执行 `src/db/xugu-migrations/001..008`，保存 ID 与 checksum。fresh install 和重复执行必须幂等；checksum 变化必须失败。

## 项目图

`project_cards` 存统一元素，`project_card_links` 存关系。导入、导出和版本克隆必须在一个显式事务内完成；同一项目版本的关系不能引用不存在或跨版本卡片。

## 生命周期

- managed：镜像校验/加载 → 容器 → 数据库就绪 → 应用。
- external：只连接，不执行 Docker 启停。
- stop：HTTP/worker/连接 → 专用容器。
- 首次 volume 冷启动等待上限 420 秒。

## 失败语义

- Docker、镜像、驱动、连接、迁移任一步失败，应用不宣称健康。
- 参数数量、结果超限、事务误用和 SQL 错误原样失败。
- 健康检查只暴露稳定状态，不回显凭据和底层连接串。
