# AI 项目作战管理平台

独立的多项目作战管理平台。每个项目可包含多个作战单元或团队，并在项目级命名空间内管理独立的发布版本和草稿版本。

## 当前结果

Phase 1 已完成：

- Node.js + SQLite 可运行数据底座；
- 项目、模板、用户、成员、版本、模块、作战单元、任务和依赖等独立实体；
- `published` 与 `draft` 独立版本图，`proposal` 只有独立元数据入口；
- `xugu-agentic-group` 脱敏夹具原子导入、幂等检查和语义等价导出；
- 项目列表、项目发布版、草稿版和旧 `/api/public` 兼容 API；
- 数据库、迁移、任务图、跨项目隔离和 API 自动化验证。

登录、完整权限、平台 UI、材料、AI 变更提案、审核、发布与回滚尚未实现。

## 环境

- Node.js 24.15 或更高版本；
- 无第三方 npm 运行依赖；
- 默认数据库：`data/platform.sqlite`（Git 忽略）；
- 可通过 `PLATFORM_DATA_DIR` 为测试或并行实例指定独立数据目录。

## 运行

```bash
npm start
```

首次启动会迁移数据库，并在不存在 `xugu-agentic-group` 时导入已提交的脱敏夹具。默认地址为 `http://127.0.0.1:4173`。

Phase 1 API：

```text
GET /health
GET /api/projects
GET /api/projects/:projectId/public
GET /api/projects/:projectId/draft
GET /api/public
```

`/api/projects/:projectId/draft` 当前只是 Phase 1 数据/API 验收入口；Phase 2 必须在开放多用户使用前加上会话和项目角色校验。

## 数据命令

```bash
npm run migrate
npm run import:xugu
npm run export:xugu
```

可使用 `--database`、`--fixture`、`--project`、`--output` 和 `--stdout` 显式指定输入输出。

## 验证

```bash
npm run verify
```

验证会使用临时数据库运行全部测试、导入/导出和 API 冒烟，并确认参考项目的 HEAD、Git 状态和脱敏种子哈希未变。

## 项目原则

- 平台管理项目，项目管理多个作战单元。
- LLM 只能生成带来源的结构化提案，不生成或执行页面代码。
- `proposal`、`draft` 和 `published` 三层分离。
- 现有虚谷应用保持只读，新平台仅迁移脱敏种子和已确认语义。
