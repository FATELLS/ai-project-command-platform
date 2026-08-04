# Performance Budgets

> Authority: constitution C-02, C-16, REFACTOR-PLAN §4.3

---

## 运行服务预算

| 指标 | 上限 | 说明 |
|---|---|---|
| 必需运行服务 | **≤ 2** | app + PostgreSQL（compact 模式） |
| 外部数据库时 | **≤ 1** | 仅 app（external DB 模式） |

超标必须写 ADR 并经用户确认。

## 应用资源预算

| 指标 | 上限 | 测量方式 |
|---|---|---|
| 应用空闲 RSS | ≤ 256 MiB | `process.memoryUsage().rss` 稳定值 |
| TypeScript errors | 0 | `tsc --noEmit` |
| Lint errors | 0 | `eslint .` |
| 循环依赖 | 0 | dependency-graph check |
| API schema 覆盖 | 100% | contract check |

## 文件大小预算

| 对象 | 软限 | 硬限 | 超限处理 |
|---|---|---|---|
| 源文件行数 | 300 行 | 500 行 | 硬限阻断 CI；软限触发警告 |
| Vue 组件 | 200 行 | 350 行 | 拆分为子组件 |

## 前端 bundle 预算

| 指标 | 上限 | 说明 |
|---|---|---|
| 登录页 JS（gzip） | ≤ 150 KB | 首屏关键路径 |
| 主应用 JS（gzip） | ≤ 500 KB | 含 Vue + Router + Element Plus 按需 |
| CSS（gzip） | ≤ 100 KB | 全局 + 主题 |
| 单个懒加载 chunk（gzip） | ≤ 200 KB | 图表/甘特/预览器 |

## 连接池预算

| 参数 | 值 | 说明 |
|---|---|---|
| Pool min | 2 | 最小连接 |
| Pool max | 10 | 最大连接（compact 模式） |
| Connection timeout | 30s | 连接超时 |
| Idle timeout | 30s | 空闲超时 |

## 检查时机

- **CI**：每次 push 和 PR
- **本地**：`npm run verify` 组合命令
- **发布前**：G17 全量检查
