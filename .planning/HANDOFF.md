# 交接

最后更新：2026-07-18

## 首先读取

1. `AGENTS.md`
2. `docs/RESULT.md`
3. `.planning/PROJECT.md`
4. `.planning/REQUIREMENTS.md`
5. `.planning/ROADMAP.md`
6. `.planning/STATE.md`
7. `AI-SPEC.md`
8. `.planning/phases/01-project-domain-data-foundation/RESEARCH.md`

## 当前状态

- Phase 1 已实现并通过验收。
- 平台当前是可运行的 SQLite 数据底座和读 API，尚无前端、登录或 AI 更新闭环。
- 首个项目为 `xugu-agentic-group`，导入数据与参考项目 v4.2 脱敏种子一致。
- 默认数据库为 `data/platform.sqlite`，已被 Git 忽略；测试和验证只使用临时数据目录。
- 参考项目位于 `../Xugu Agentic Group Schedule/outputs/xugu-ai-transformation-console/`，必须继续只读。

## 代码入口

- HTTP：`server.mjs`、`src/http/app.mjs`
- SQLite：`src/db/database.mjs`、`src/db/migrate.mjs`、`src/db/migrations/`
- 项目校验：`src/domain/project-validator.mjs`
- 仓储：`src/repositories/project-repository.mjs`
- 虚谷迁移：`src/migration/legacy-project.mjs`
- CLI：`scripts/migrate-db.mjs`、`scripts/import-project.mjs`、`scripts/export-project.mjs`
- 验证：`scripts/verify.mjs`、`test/`

## 验证

```bash
npm run verify
```

当前通过：

- 12 项 Node.js 自动化测试；
- 新建与重复数据库迁移；
- 虚谷原子导入、幂等导入、冲突拒绝和语义等价导出；
- 两项目仓储与 API 隔离；
- `/api/projects/xugu-agentic-group/public` 与 `/api/public` 兼容一致性；
- 参考项目 HEAD、Git 状态和种子 SHA-256 不变。

## 风险和边界

- Phase 1 尚无会话和角色校验；`draft` API 仅用于本地阶段验收，不得在 Phase 2 权限完成前公开部署。
- 当前平台名称仍可在后续确认，但稳定项目 ID 不应随显示名称改变。
- `node:sqlite` 技术选择要求 Node.js 24.15+；参考应用本身的 Node 18 运行边界不受影响。
- 数据库备份/恢复、完整审计和发布/回滚在后续阶段完成。

## 下一步

- 规划 Phase 2：会话、基础角色、项目列表/检索/切换、项目创建/归档和项目壳。
- 将 `draft` 和项目管理 API 放在项目成员权限之后。
- 保持 `/api/public` 为有限期兼容入口，新功能使用项目级 URL。
