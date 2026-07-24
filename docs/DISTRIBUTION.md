# Windows / Linux 分发说明

## 目标

- Windows 10/11 x64 解压即用；
- Linux x64 portable 解压即用；
- RHEL 系 x64 通过 RPM 安装、注册 systemd 并自动启动；
- 所有安装包都自带 Node.js 运行时；
- 所有安装包都不携带项目数据、数据库、材料或密钥。

## 产物

Git 标签 `v0.8.0` 触发 `.github/workflows/release.yml`：

1. 下载固定版本的 Node.js Windows/Linux x64 运行时；
2. 通过 `scripts/assemble-release.mjs` 复制运行白名单；
3. 运行 `npm ci --omit=dev --ignore-scripts`；
4. 检查产物中不存在 fixtures、planning、test、env.local、SQLite/DB 或日志；
5. 生成 Windows ZIP、Linux tar.gz 和 RPM；
6. 上传 GitHub Release。

## RPM 行为

- 程序：`/opt/ai-project-command-platform`
- 配置：`/etc/ai-project-command-platform/platform.env`
- 数据：`/var/lib/ai-project-command-platform/data`
- 服务：`ai-project-command-platform.service`
- 运行用户：`aipcp`

首次安装生成管理员随机密码并写入：

```text
/var/lib/ai-project-command-platform/bootstrap-credentials.txt
```

服务成功启动后，配置文件中的明文 bootstrap password 会被清空；凭据文件仍以 root-only 权限保留，供管理员首次登录。首次登录后应修改密码并删除该文件。

## 数据边界

`server.mjs` 不再对全新数据库自动导入 Xugu 或任何项目夹具。仅在显式设置 `PLATFORM_SEED_FIXTURE` 时执行一次指定迁移；Release 默认配置不设置该变量。

运行包只包含：

- `server.mjs`
- `package.json` / `package-lock.json`
- `public/`
- `src/`
- 生产依赖
- 目标平台 Node.js 运行时
- 启停脚本与用户说明

不会包含：

- `.planning/`
- `fixtures/`
- `test/`
- `data/`
- `.env.local`
- 上传、预处理、日志、备份、诊断或导出内容
