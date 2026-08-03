# Architecture Decisions

## D-001 多项目与项目级隔离

- 状态：accepted
- 决策：所有业务对象与权限按 `projectId` 隔离；未授权项目对调用方表现为不存在。

## D-002 固定模块与数据驱动差异

- 状态：accepted
- 决策：页面由固定 renderer 构建，项目差异只来自数据、模板、术语和主题。

## D-003 AI 只生成结构化建议

- 状态：accepted
- 决策：LLM 只能返回有证据的 `ChangeProposal`，无工具权限，不写草稿或发布态。

## D-004 人工审核与版本化发布

- 状态：accepted
- 决策：提案逐项审核；合并创建新 draft；发布推进版本指针；回滚只到直接前驱；全过程追加审计。

## D-005 统一卡片项目图

- 状态：accepted
- 决策：`project_cards` 与 `project_card_links` 是版本化项目图唯一读写模型；公共字段表列化，类型特有字段进入 `card_attrs`。

## D-006 虚谷唯一后端

- 状态：accepted
- 日期：2026-08-02
- 决策：代码、迁移、测试、备份和发布只支持虚谷，不保留第二后端或兼容分支。

## D-007 虚谷纳入产品生命周期

- 状态：accepted
- 日期：2026-08-02
- 决策：默认 managed 模式由平台按依赖顺序启停专用虚谷和应用；external 模式不得管理共享实例。

## D-008 Worker 驱动桥接

- 状态：accepted
- 日期：2026-08-02
- 决策：原生驱动独占 Worker 并按 callback API 执行；主线程通过 SharedArrayBuffer 获得同步仓储语义。

## D-009 冷 volume 备份恢复

- 状态：accepted
- 日期：2026-08-02
- 决策：容器停止后归档专用 volume，校验归档与 SHA-256；恢复前自动保存当前 volume。

## D-010 ARM64 完整栈发布

- 状态：accepted
- 日期：2026-08-02
- 决策：V1 只交付 Linux ARM64 与 macOS Apple Silicon portable；产物包含 Node runtime、虚谷镜像、原生驱动和生命周期脚本。

## D-011 密钥与日志脱敏

- 状态：accepted
- 决策：完整密钥只存在服务端配置；API 返回 masked 状态；日志只记录稳定错误码和安全标签。

## D-012 V1 单一工程收口

- 状态：accepted
- 日期：2026-08-02
- 决策：移除过时阶段实现记录、未支持包格式、npm 发布入口和重复运行路径；后续演进不得重新制造平行工程。

## D-013 Node 20 原生驱动 ABI

- 状态：accepted
- 日期：2026-08-02
- 决策：V1 源码运行和测试统一使用 Node 20.x；扩大版本范围前必须重新取得并验证对应虚谷原生驱动。
