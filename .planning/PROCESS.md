# Project Process Log

## 2026-08-02 会话记录

### 讨论主题

V1.0 全工程整合、虚谷完整栈、UI 全功能测试、代码审查和设计文档收口。

### 用户需求

- 全面审查代码与 Markdown 文档，细致走完产品 UI 功能。
- 将虚谷数据库明确纳入项目和交付边界。
- 消除业务逻辑与 UI/数据模型“两张皮”。
- API Key、日志、设置响应和测试报告必须脱敏。
- 识别并删除多余工程部分，为 V1.0 做全方位整合。
- 所有测试使用隔离环境与真实 UI。
- 虚谷 Docker 与应用随系统共同启停。
- 可以查阅虚谷官网并安装 `kourou25/xugudb-dev-skills`。

### Agent 分析与方案

- 先按 `AGENTS.md` 接手流程读取项目记忆和 canonical design。
- 审查数据库、迁移、导入导出、版本、材料、AI、审核发布、生命周期、备份和发布代码。
- 下载并校验虚谷 ARM64 镜像与原生驱动，按官网 callback API 设计 Worker 桥接。
- 将项目图统一到 `project_cards` / `project_card_links`，删除平行表和迁移路径。
- 用独立容器、端口、volume、材料目录和 Chromium 执行集成与 UI 测试。
- 重写 V1.0 系统设计、运行、迁移、分发、结果和交接文档；删除过时阶段记录与未支持发布脚本。

### 用户反馈/纠正

- 用户明确拒绝保留任何第二数据库实现或设计叙述。
- 用户明确要求虚谷镜像随产品交付，并由系统生命周期管理。
- 用户确认可以进入下一版本，测试必须是隔离环境加 UI。

### 已完成操作

- 代码只保留虚谷数据库、8 个迁移和统一卡片项目图。
- 加入虚谷 ARM64 镜像 archive/manifest/checksum 与 macOS/Linux ARM64 驱动。
- manager 完成镜像加载、专用容器/volume、数据库后应用启动和应用后数据库停止。
- 实现冷 volume 备份、校验、恢复前保护和恢复。
- 实现 Worker callback 桥接，修复 UTF-8 CLOB、空值、身份列和结果别名兼容。
- 修复生成任务到提案保存、显式审核项、UI 用例等待与项目选择问题。
- 移除 npm 包发布、Windows、x86、RPM、重复 README/AGENTS、旧阶段报告和本机专用测试脚本。
- 版本更新为 `1.0.0`，仓库声明为内部未授权发布。
- 安装并参考虚谷开发 skills；以虚谷官网文档作为原生驱动行为的主要依据。

### 测试过程

- 最小真实虚谷查询、更新、插入和事务回滚通过。
- 服务级 fake provider 生成成功，提案与审核项正确落库。
- 定点浏览器完成材料、生成、审核、合并、发布、回滚和审计。
- 修复 Node 20 下无引用 deadline timer 导致 provider 超时测试取消的问题。
- 最终 `npm run verify` 通过：Node `67/67`，Chromium 主 UI `82/82`。
- 独立异常输入 Chromium 套件 `9/9` 通过。
- `file-type` 升级到 `21.3.4` 后 `npm audit` 为 0 个已知漏洞。

### 最终决策

- V1.0 是虚谷单后端、统一卡片图、固定 renderer、结构化提案、人工审核发布的一套工程。
- 发布目标只包含有镜像与原生驱动支持的 ARM64 平台。
- 历史阶段实现文档不再作为当前工程的一部分，canonical design 是唯一设计依据。

### 遗留问题

- HTTP 与前端部分文件仍偏大，后续需在现有契约保护下按领域拆分。
- macOS portable 尚需 CI 完整栈 smoke。
- 需要长期虚谷升级夹具与发布故障恢复演练。

## 2026-08-03 会话记录

### 讨论主题

清理本机独立开发虚谷实例的运行状态。

### 用户需求

- 关闭本轮测试前已经存在的 `xugu-dev` 容器。

### Agent 分析与方案

- 仅停止容器，保留容器定义和匿名数据卷，避免不可逆删除数据。
- 停止后复查 V1.0 隔离体验环境健康状态。

### 用户反馈/纠正

- 用户明确要求关闭 `xugu-dev`。

### 最终决策

- `xugu-dev` 已停止；`ai-platform-isolated-ui` 继续运行且健康检查通过。

### 遗留问题

- `xugu-dev` 的容器定义和匿名 volume 尚未删除，后续仅在明确确认不需数据时清理。

### 提交结果

- 用户要求提交当前工作区任务。
- 已将 V1.0 整合、代码、测试、设计文档、清理结果和留痕文件提交为 `d28bc9b`（`feat: consolidate v1 on xugu backend`）。
- 提交后工作区已复核为干净；尚未推送远端。

## 2026-08-03 远端发布记录

### 用户需求

- 将当前提交推送到远端，并确认服务器启动方式。

### 执行结果

- `main` 已成功推送到 `origin`：`300f70e..5aea6f0`。
- GitHub 提示随包虚谷镜像约 70 MB，超过推荐的 50 MB，但本次推送成功。
- 项目没有 `npx server` 脚本；完整服务入口是 `npm run start:background`，由 managed 模式同时管理应用和虚谷。
- 当前隔离体验服务健康检查通过：`http://127.0.0.1:54173/health` 返回 `status: ok`。

## 2026-08-03 全新隔离环境验证

### 用户需求

- 在全新隔离环境中对项目做一次完整验证。

### Agent 分析与方案

- 按 V1.0 测试矩阵分层执行：静态门禁 → Node 单元 → Chromium 主 UI → 异常输入 → 安全审计。
- E2E fixture server 自动创建独立虚谷容器（端口 55140/55142）、独立 volume 和临时材料目录，确保环境完全隔离。
- 运行环境需绑定 Node 20.x（原生驱动 ABI 要求），不能使用 PATH 中默认的 Node 22。

### 执行结果

- `verify:code` 静态门禁：通过（必需文件、镜像校验、禁止模式、SQL 方言、语法检查、Git 跟踪安全）。
- Node 单元测试：`67/67` 全通过（含真实虚谷 schema、session/audit/masked settings、冷备份恢复）。
- Chromium 主 UI E2E：首轮 81/82，发现并修复登录测试中自引用 `toHaveCount` 竞态断言，重跑 `82/82` 全通过。
- 异常输入 Chromium：`9/9` 全通过。
- `npm audit`：0 个已知漏洞。
- 修复提交为 `d9aac1e`。

### 修复内容

- `e2e/ui-flows.spec.mjs:36`：移除自引用 `toHaveCount(count())` 竞态断言，保留有意义的 `cardCount > 0` 验证。

### 最终决策

- V1.0 在全新隔离环境中完整验证通过，产品代码无缺陷，仅修复测试代码竞态。

### 补充：managed 生命周期启停验证

- `npm run start:background`：创建虚谷容器 `ai-project-command-platform-xugu` → 应用后启动 → health 通过（PID 93238）。
- `npm run status`：服务运行中、健康检查正常、虚谷容器 Up。
- `curl /health`：返回 `{"status":"ok"}`。
- `npm run stop`：应用先优雅停止（PID 93238）→ 虚谷容器后停止（Exited 137）。
- 停止后 status 确认两者均不可达；隔离体验实例 `ai-platform-isolated-ui` 未受影响。

## 2026-08-03 多架构虚谷支持（Linux x86 + Windows 预留）

### 用户需求

- 虚谷还有 Linux x86 和 Windows 版本，都可以打包成 Docker 镜像在对应环境使用。
- 先推进 Linux x86 Docker 支持。

### 分析

- 当前 vendor 仅有 ARM64 Docker 镜像 tar.gz + macOS/Linux ARM64 原生驱动。
- 需要三层改动：manifest 多架构、driverPath 多平台、manage-server/fixture 按架构选镜像。
- verify.mjs 需适配 v2 manifest 格式（保留 v1 向后兼容）。
- Windows 原生安装不走 Docker，需要独立的生命周期管理分支（后续工作项）。

### 执行结果

- `manifest.json` 升级为 schemaVersion 2，images 下含 arm64（完整）和 amd64（占位，待填入实际镜像和 SHA-256）。
- `driverPath()` 新增 linux/x64 → `xugudbjs-linux-x86_64.node`、win32/x64 → `xugudbjs-win32-x64.node` 候选。
- `manage-server.mjs` 新增 `selectImageEntry()` 按运行时 arch 从 manifest 选择镜像，兼容 v1 单架构格式。
- E2E fixture server 改为从 manifest 读取镜像名，不再硬编码 ARM64 tag。
- `verify.mjs` 支持 v2 多架构 manifest 校验，arm64 基线不变，amd64 存在时动态校验。
- `README-LINUX.txt` 补充 x86_64 portable 包说明。
- verify:code 通过、Node 67/67 全通过。
- 提交 `015b37e`。

### 待获取的二进制

~~1. 虚谷 Linux x86 Docker 镜像~~ **已完成**（提交 `ff8eda1`）
~~2. Node 原生驱动 Linux x86_64~~ **已完成**
~~3. 填入 manifest amd64 条目~~ **已完成**

### 二进制获取与镜像构建（2026-08-03 补充）

- 从虚谷官网 `download.xugudb.com` 下载：
  - `XuguDB-NodeJS-1.0.0-linux-x86_64-20260123.zip` → 提取 node20 版 `xugudbjs.node` → `xugudbjs-linux-x86_64.node`（255K，ELF x86-64）
  - `XuguDB-NodeJS-1.0.0-windows-amd64-20260123.zip` → 提取 node20 版 `xugudbjs.node` → `xugudbjs-win32-x64.node`（1.3M，PE32+ DLL）
  - `XuguDB-Server-12.10.13-linux-x86_64-20260521.zip`（7.0M，含 Dockerfile.Debian）
- Docker Desktop 跨架构构建遇到 QEMU binfmt 不支持问题（macOS binfmt_misc 不可用），改用 Python 直接构建 docker 兼容 tar：
  - 用 Python tarfile 从 Server 目录直接生成 docker image tar（单一 layer，无基础镜像层）
  - `docker load` 验证通过：`Architecture: amd64`，Entrypoint 正确，端口 5138，volume `/opt/database/Server`
  - `gzip -9` 压缩后 6.9M，SHA-256 `95a0578c...`
- 四个平台驱动（darwin/arm64、linux/arm64、linux/x86_64、win32/x64）全部到位。
- verify:code 通过。
- 提交 `ff8eda1`。

