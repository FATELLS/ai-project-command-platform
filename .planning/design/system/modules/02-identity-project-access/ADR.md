# ADR S-02：服务端项目授权、稳定项目身份与统一拒绝

状态：`accepted / implemented`
关联：D-002、D-006、D-009、D-030

## Context

平台管理多个内部项目，项目成员拥有不同写权限。项目、材料、问答、提案和版本必须隔离，同时不能通过错误差异枚举项目或对象存在性。

## Decision

- 项目使用稳定字符串 ID，生命周期为 active/archived。
- 用户身份通过服务端随机会话和 HttpOnly Cookie 维护。
- 项目权限由 platform admin 或 `project_members.role` 决定。
- 服务端对每次请求重新授权并返回 capability。
- 不存在与无权限统一表现为 404。
- 写请求使用内存 CSRF token。
- 创建项目只允许平台管理员，三种 UI 入口最终调用同一受控创建语义。

## Rejected Alternatives

| 方案 | 原因 |
|---|---|
| JWT 存前端 | 难以撤销并增加可重放凭据暴露。 |
| 前端根据 role 控制权限 | 只能改善 UI，不能形成安全边界。 |
| 全平台共享编辑权限 | 违反项目隔离。 |
| 物理删除项目 | 破坏历史版本、材料和审计。 |

## Consequences

- 所有项目域 API 必须显式接收 projectId。
- UI 可隐藏操作，但服务端 capability 是最终依据。
- 归档不删除项目数据。

## Invariants

- 最后一个平台管理员和项目管理员受到保护。
- 会话过期后不能通过 Back 查看缓存敏感内容。
- bootstrap 默认密码必须强制首次修改。
