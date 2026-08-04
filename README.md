# AI 项目作战管理平台

面向多项目、多团队的项目推进平台。路线图、作战单元、排期、健康度、材料、AI 结构化提案、人工审核与发布都在同一项目命名空间内运行。

当前版本：`1.0.0`。

## 一行安装

**Linux / macOS：**

```bash
curl -fsSL https://github.com/FATELLS/ai-project-command-platform/releases/latest/download/install.sh | bash
```

**Windows（PowerShell）：**

```powershell
irm https://github.com/FATELLS/ai-project-command-platform/releases/latest/download/install.ps1 | iex
```

脚本自动检测操作系统和架构，下载对应的发布包，安装系统依赖，启动平台并打印管理员凭据。

| 平台 | 虚谷运行方式 | 需要容器？ |
|------|------------|-----------|
| Linux ARM64 | native（直接跑二进制） | 否 |
| Linux x86_64 | native | 否 |
| Windows amd64 | native | 否 |
| macOS Apple Silicon | 容器 VM（自动装 Colima） | 是 |

## 产品边界

- 虚谷数据库是唯一持久化后端。
- `project_cards` 与 `project_card_links` 是唯一版本化项目图模型。
- LLM 只能生成有来源的结构化 `ChangeProposal`，不能生成页面代码，也不能审核、合并或发布。
- 项目、材料、证据、问答、生成任务和权限按 `projectId` 隔离。
- 页面由固定白名单 renderer 渲染，项目差异来自数据、模板、术语和主题。

## 运行要求

- Apple Silicon macOS 或 Linux ARM64。
- Node.js `20.x`（源码运行；随包原生驱动按此 ABI 验证）。
- Docker 或 Docker Desktop。
- 至少 4 GB 可用内存和足够的 Docker volume 空间。

仓库已包含：

- 虚谷 `12.9.10-arm64` Docker 镜像归档与校验清单；
- macOS ARM64 与 Linux ARM64 原生 Node.js 驱动；
- 8 个有序虚谷迁移；
- 应用与数据库统一启停、冷备份和恢复命令。

## 源码启动

```bash
npm ci
cp .env.example .env.local
npm run start:background
npm run status
```

打开 <http://127.0.0.1:4173>。

默认 managed 模式会校验并按需加载内置镜像，创建专用容器与 volume，等待虚谷就绪后启动应用。停止顺序相反：

```bash
npm run stop
```

前台开发可使用 `npm start`；该命令只启动应用进程，要求虚谷已经可连接。共享外部数据库必须显式设置：

```dotenv
PLATFORM_XUGU_LIFECYCLE=external
XUGU_HOST=127.0.0.1
XUGU_PORT=5138
```

## 首次管理员

portable 启动脚本会生成随机管理员密码并写入仅本机可读的首次凭据文件。源码运行应在 `.env.local` 中设置强密码：

```dotenv
PLATFORM_BOOTSTRAP_PASSWORD=replace-with-a-strong-password
```

首次登录后立即修改密码并删除首次凭据文件。

## AI 配置与脱敏

AI 默认关闭。真实密钥只能放在未跟踪的 `.env.local`、本地 API 配置或平台设置中：

```dotenv
AI_GENERATION_PROVIDER=openai-compatible
AI_GENERATION_BASE_URL=https://example.com/v1
AI_GENERATION_API_KEY=replace-me
AI_GENERATION_MODEL=replace-me
AI_GENERATION_ALLOWED_HOSTS=example.com
```

设置接口只返回是否已配置及脱敏摘要，不返回完整密钥。日志只记录稳定错误码、模型安全标签和计量信息，不记录凭据或原始 provider 异常。

## 项目迁移

仓库不在首次启动时导入任何公司项目。显式导入已脱敏夹具：

```bash
npm run import:xugu
npm run export:xugu
```

稳定项目 ID 为 `xugu-agentic-group`。导入、导出和版本克隆全部走统一卡片模型。

## 备份与恢复

数据库使用 Docker volume 冷备份。先停止平台：

```bash
npm run stop
npm run backup -- --output /secure/path/xugu-backup.tar.gz
npm run restore -- --source /secure/path/xugu-backup.tar.gz --confirm RESTORE
npm run start:background
```

备份会校验归档可读性、大小和 SHA-256。恢复前会自动保存当前 volume 的 pre-restore 备份。不要用复制材料目录代替数据库备份。

## 验证

```bash
npm run verify:code
npm test
npm run test:xugu
npm run test:e2e
npm run test:e2e:abnormal
```

真实虚谷集成测试在独立容器、端口和 volume 中执行；UI 套件也使用独立虚谷环境和真实浏览器，不复用开发数据库。

## 发布

唯一发布组装入口是 `scripts/assemble-release.mjs`。支持：

- `linux-arm64`
- `macos-arm64`

产物包含 Node.js 运行时、虚谷镜像、对应原生驱动、应用代码和启停脚本，不包含项目数据、材料、密钥、日志、测试或规划目录。GitHub Release 工作流当前构建并烟测 Linux ARM64 完整栈。

## 数据边界

运行数据不进入 Git：

- 虚谷数据位于专用 Docker volume；
- 材料、处理结果和运行文件位于 `PLATFORM_DATA_DIR`；
- `.env.local`、本地 API 配置、备份、日志、诊断和浏览器会话均被忽略；
- 发布包不包含 `fixtures/`、`.planning/`、`test/` 或任何公司数据。

## 授权

项目仅供内部使用，未开放许可。
