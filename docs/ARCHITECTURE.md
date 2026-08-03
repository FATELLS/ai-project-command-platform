# 架构概览

平台是 Node.js 20 模块化单体，虚谷是唯一数据库。浏览器通过 HTTP API 使用项目工作区；领域服务通过 Worker 中的虚谷原生驱动读写同一事务域；材料文件保存在项目隔离目录；AI Provider 仅接收受控上下文并返回结构化 JSON。

核心链路：

`材料 → 证据 → readiness → GenerationJob → ChangeProposal → 人工审核 → draft → publish → rollback/audit`

核心数据：

- `projects` / `project_versions`
- `project_cards` / `project_card_links`
- materials / evidence / generation jobs
- change proposals / review items / release events / audit events

运行时默认管理平台专用虚谷 Docker 容器，数据库就绪并执行迁移后才启动应用健康状态。完整架构、故障语义和信任边界以 [canonical architecture](../.planning/design/system/ARCHITECTURE.md) 为准。
