# V1.0 工程整合结论

状态：`implemented baseline`

## 已收口

- 单一虚谷数据库后端、单一迁移目录、单一项目图模型。
- 单一 server 入口、配置加载器、Playwright 主配置和发布组装入口。
- 虚谷镜像与 ARM64 驱动随产品交付，managed 生命周期随系统启停。
- 导入、导出、版本克隆、发布事实与 renderer 共用统一卡片逻辑。
- 冷备份、校验、恢复前保护和真实 volume 恢复测试。
- Windows、x86、RPM、npm 包发布和过时阶段报告退出 v1.0 边界。

## 验证基线

- `npm run verify`：Node 单元与真实虚谷集成 `67/67`，Chromium 主 UI `82/82`。
- 独立异常输入 Chromium：`9/9`。
- 真实虚谷覆盖迁移、中文 CLOB、事务、冷备份与 volume 恢复。
- `npm audit`：0 个已知漏洞。

## 保留的后续工程工作

- 按领域拆分体积较大的 `src/http/app.mjs`、`public/app.js`、`public/modules/renderers.js` 和样式文件，同时保持路由与 UI 契约。
- 为 macOS portable 增加与 Linux 同等级的 CI 组装和首次启动 smoke。
- 增加从早期虚谷 Schema 到 1.0.0 的长期升级夹具和版本兼容窗口。
- 扩展发布故障恢复编排、全角色键盘矩阵和视觉回归。

这些工作不得重新引入第二数据库、第二项目图或第二发布清单。
