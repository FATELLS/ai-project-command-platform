# Implemented Result

版本：`1.0.0`
日期：2026-08-02

## 产品

- 多项目、项目切换、成员与四级角色权限。
- 总览、路线图、作战单元、甘特、健康和项目资料工作区。
- 统一卡片路线图、版本化项目图与受控卡片编辑提案。
- 材料上传/人工录入、模板、提取、证据、readiness、问答和生成。
- 结构化提案逐项审核、草稿合并、发布、直接前驱回滚和审计。

## 数据与运行

- 虚谷是唯一数据库；8 个有 checksum 的迁移。
- `project_cards` / `project_card_links` 是唯一项目图模型。
- ARM64 原生驱动通过 Worker callback 桥接，支持 UTF-8、中文 CLOB、事务和参数化查询。
- 虚谷镜像归档、manifest、SHA-256 与驱动随产品代码交付。
- managed 模式随系统启停专用虚谷；external 模式只连接共享实例。
- 冷 volume 备份、归档校验、恢复前保护和恢复能力已实现。

## 迁移

- `xugu-agentic-group` 稳定 ID 保留。
- 7 个作战单元、29 项任务、6 个阶段及日期、父子和依赖关系无损导入导出。
- published/draft 克隆、AI published facts 和 UI renderer 共用统一卡片模型。

## 安全

- 密码哈希、会话、CSRF、登录限流、角色权限和项目隐藏。
- Provider HTTPS、主机白名单、无工具调用和有界上下文。
- 设置响应、日志和报告对 API Key 与原始异常脱敏。
- 发布包排除项目数据、材料、运行卷、凭据、日志、测试和规划目录。

## 发布

- 唯一组装入口支持 Linux ARM64 与 macOS Apple Silicon portable。
- GitHub workflow 在 ARM64 runner 校验/加载虚谷镜像并执行完整栈 health smoke。
- 已移除未支持的 Windows、x86、RPM 与 npm 包发布入口。

## 验证

- 真实虚谷最小读写、中文、事务和回滚：通过。
- 材料→生成→审核→合并→发布→回滚→审计浏览器闭环：通过。
- 最终 `npm run verify`：Node `67/67`、Chromium 主 UI `82/82`，全部通过。
- 独立异常输入 UI：`9/9` 通过；依赖审计：0 个已知漏洞。
- 详细覆盖见 `docs/ui-full-function-test-2026-08-02.md`。
