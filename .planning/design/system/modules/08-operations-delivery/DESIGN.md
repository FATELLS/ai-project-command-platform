# Operations & Delivery Design

## 运维入口

- `npm run start:background|status|restart|stop`
- `npm run backup -- --output <archive>`
- `npm run restore -- --source <archive> --confirm RESTORE`
- `npm run verify`

## 状态与健康

状态同时报告应用 PID/HTTP 健康和专用虚谷容器状态。只有应用迁移完成并可查询数据库时 `/health` 才返回成功。

## 备份

1. 要求专用容器停止。
2. 以同版本虚谷镜像挂载 volume 只读并生成 gzip tar。
3. 再次挂载归档执行目录检查。
4. 返回字节数和 SHA-256。

## 恢复

1. 要求专用容器停止并校验源归档。
2. 先将当前 volume 备份为 `pre-restore` 归档。
3. 清空 volume 并展开源归档。
4. 启动后执行迁移与业务数据校验。

## 发布白名单

允许：server、package metadata、README、env 示例、public、src、manager、vendor/xugudb、runtime、平台脚本。
禁止：fixtures、planning、test、运行数据、材料、凭据、日志、报告和备份。

## 支持矩阵

- Linux ARM64：CI 构建、镜像 load、managed start 和 `/health` smoke。
- macOS ARM64：组装、原生驱动和 Docker Desktop 运行路径。
- 其他平台：明确不支持，不保留误导性脚本。

## 脱敏

- provider 和 HTTP 错误日志只输出稳定代码与 requestId。
- 设置读取只返回 masked key 状态。
- 测试使用独立固定测试凭据，但报告不记录密码。
- release audit 对文件名、扩展名和目录执行拒绝清单。
