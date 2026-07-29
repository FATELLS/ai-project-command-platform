# AI 项目作战管理平台

面向多项目、多团队的项目推进平台。路线图、作战单元、排期、健康度、材料、AI 结构化提案、人工审核与发布都在同一项目命名空间内运行。

当前发布版本：`0.8.0`

## 核心边界

- LLM 只能生成带来源的结构化 `ChangeProposal`，不能生成页面代码。
- AI 不能审核、合并或发布，也不能直接写入 `draft` 或 `published`。
- 项目、材料、证据、问答、生成任务和角色权限按 `projectId` 隔离。
- 页面由固定白名单 renderer 渲染；项目差异来自数据、模板、术语与主题配置。
- 项目路线图采用主任务时间线和两级副任务卡片，精确工期由独立甘特视图承担。

## 安装包

GitHub Release 提供三个不含项目数据的 x64 产物：

| 系统 | 产物 | 启动方式 |
| --- | --- | --- |
| Windows 10/11 | `ai-project-command-platform-0.8.0-windows-x64.zip` | 解压后运行 `Start.ps1` |
| Linux 通用版 | `ai-project-command-platform-0.8.0-linux-x64.tar.gz` | 解压后运行 `./start.sh` |
| RHEL 系 RPM | `ai-project-command-platform-0.8.0-1.x86_64.rpm` | 安装即注册并启动 systemd 服务 |

安装包自带 Node.js 运行时，不要求目标机器预装 Node 或 npm。

### RPM 一行安装并启动

仓库默认为私有仓库，先用 `gh auth login` 登录一次，然后执行：

```bash
tmp="$(mktemp -d)" && gh release download v0.8.0 -R FATELLS/ai-project-command-platform -p '*.rpm' -D "$tmp" && sudo rpm -Uvh "$tmp"/*.rpm
```

适用于 RHEL、Rocky Linux、AlmaLinux、CentOS Stream 8 及以上版本。安装完成后：

```bash
sudo systemctl status ai-project-command-platform
sudo cat /var/lib/ai-project-command-platform/bootstrap-credentials.txt
```

默认地址为 <http://127.0.0.1:4173>。RPM 首次安装会创建独立系统用户、空数据目录、管理员随机密码和 systemd 服务，并自动启动。首次登录后请立即修改密码并删除凭据文件。

### Windows

```powershell
gh release download v0.8.0 -R FATELLS/ai-project-command-platform -p "*windows-x64.zip"
Expand-Archive .\ai-project-command-platform-0.8.0-windows-x64.zip
Set-ExecutionPolicy -Scope Process Bypass
.\ai-project-command-platform-0.8.0-windows-x64\Start.ps1
```

首次管理员凭据会显示在窗口中，并写入 `first-run-credentials.txt`。使用同目录的 `Stop.ps1` 停止服务。

### Linux 通用版

```bash
gh release download v0.8.0 -R FATELLS/ai-project-command-platform -p '*linux-x64.tar.gz'
tar -xzf ai-project-command-platform-0.8.0-linux-x64.tar.gz
./ai-project-command-platform-0.8.0-linux-x64/start.sh
```

使用 `./stop.sh` 停止。运行数据位于解压目录的 `data/`。

## 源码运行

要求 Node.js 24.15 或更高版本：

```bash
npm ci
cp .env.example .env.local
```

首次启动时，如果未设置 `PLATFORM_BOOTSTRAP_PASSWORD`，平台会自动创建默认管理员 **admin / admin123**，首次登录后需立即修改密码。也可以手动设置：

```dotenv
PLATFORM_BOOTSTRAP_PASSWORD=请替换为强密码
```

然后启动：

```bash
npm start
```

默认账号为 `admin`，默认地址为 <http://127.0.0.1:4173>。全新数据库不会自动导入任何公司项目；登录后可创建项目，或通过显式导入命令导入已经脱敏并确认可用的项目夹具。

## LLM 配置

LLM 默认禁用。真实密钥只能放在未跟踪的 `.env.local` 或部署平台的密钥系统中：

```dotenv
AI_GENERATION_PROVIDER=openai-compatible
AI_GENERATION_BASE_URL=https://example.com/v1
AI_GENERATION_API_KEY=replace-me
AI_GENERATION_MODEL=replace-me
AI_GENERATION_ALLOWED_HOSTS=example.com
```

不要把密钥写进 README、源码、GitHub Actions 日志或诊断包。

## 数据目录与隐私

源码仓库和 Release 安装包都不包含运行数据库、上传原件、预处理材料、API Key、日志或备份。

- 源码默认数据：`data/platform.sqlite`
- RPM 数据：`/var/lib/ai-project-command-platform/data`
- RPM 配置：`/etc/ai-project-command-platform/platform.env`
- Windows/Linux portable：解压目录内的 `data/` 与 `.env.local`

以下内容已由 `.gitignore` 排除：

- `.env`、`.env.local` 和所有真实凭据；
- SQLite/DB/WAL 文件；
- `uploads/`、`processed/`、`backups/`、`diagnostics/` 和导出文件；
- Release 构建物、日志、浏览器会话与测试报告。

仓库中的 Xugu 夹具仅用于迁移和语义等价测试，必须保持脱敏；正式安装包采用运行文件白名单，明确排除 `fixtures/`、`.planning/`、`test/` 和所有项目数据。

## 备份与恢复

源码运行：

```bash
npm run backup -- --output /secure/path/platform-backup.sqlite
npm run restore -- --input /secure/path/platform-backup.sqlite
```

RPM 部署应在停止服务后备份：

```bash
sudo systemctl stop ai-project-command-platform
sudo cp -a /var/lib/ai-project-command-platform /secure/backup/
sudo systemctl start ai-project-command-platform
```

## 验证与构建

```bash
npm run verify
```

当前验证基线为 157 项后台测试和 35 项 Playwright 浏览器 E2E，并包含迁移、安全、项目隔离、浏览器证据与参考项目只读检查。

Release 工作流位于 `.github/workflows/release.yml`。推送 `v*` 标签后自动构建 Windows ZIP、Linux tar.gz 和 RPM，并上传到对应 GitHub Release。分发组装脚本采用运行文件白名单并执行数据泄漏检查。

## 许可证

当前未配置开源许可证，默认仅供内部使用。仓库应保持为私有仓库。
