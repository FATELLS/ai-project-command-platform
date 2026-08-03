# 系统需求追踪

状态：`canonical`

| 需求 | 设计/代码 | 主要验证 |
|---|---|---|
| DATA-01 虚谷唯一后端 | `src/db/`, `vendor/xugudb/` | `test/xugu-integration.test.mjs` |
| DATA-02 统一项目图 | `project-repository`, `version-store`, migration 008 | 导入导出与 UI 路线图 |
| OPS-01 一体启停 | `scripts/manage-server.mjs`, portable scripts | release smoke、隔离 UI 启动 |
| OPS-02 冷备恢复 | `database-backup.mjs`, backup/restore scripts | Xugu integration backup/restore |
| SEC-01 认证与 CSRF | auth repository/service、HTTP app | auth E2E 与安全领域用例 |
| SEC-02 项目隔离 | permission services、project-scoped SQL | 角色矩阵与跨项目 E2E |
| SEC-03 密钥脱敏 | settings service、provider logging | 设置与集成断言 |
| MAT-01 材料证据 | materials/evidence/worker | 材料与异常输入 E2E |
| AI-01 有来源结构提案 | proposals、validator、prompt | 生成闭环与 provider tests |
| GOV-01 人工审核发布 | review、version apply、release | 生成审核发布回滚 E2E |
| UI-01 全工作区可用 | `public/`, renderers | 82 条主 UI/领域浏览器用例 |
| UI-02 异常与响应式 | abnormal config、UI flows | 9 条异常用例及多视口检查 |
| REL-01 无数据发布包 | assemble release、workflow | 静态白名单与 Linux stack smoke |

任何新增需求必须同时补充代码所有者、自动化验证和失败语义。
