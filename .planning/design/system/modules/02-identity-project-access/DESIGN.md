# Design S-02：Identity & Project Access

状态：`implemented baseline`

## Domain

### User

- 稳定 ID、login name、display name。
- scrypt 密码摘要和盐。
- active/disabled。
- platform admin 标志。
- must-reset-password。

### Session

- 随机 token 只在 Cookie 中出现。
- 数据库存 token SHA-256 摘要。
- 空闲 4 小时、绝对 8 小时。
- CSRF token 与 session 关联，只返回当前页面内存。

### Project

- 稳定 ID、名称、模板、术语、主题、状态。
- current published/draft version 指针。
- archived 项目保留历史。

### Membership

角色：

- `project_admin`
- `project_editor`
- `viewer`

platform admin 在所有项目上拥有管理能力，但仍经过相同 service 入口和审计。

## Authentication Flow

`POST /api/login`：

1. 校验来源窗口限流。
2. 规范化 login name。
3. 常量级安全比较密码摘要。
4. 创建摘要会话。
5. 设置 HttpOnly/SameSite Cookie。
6. 返回 user、csrfToken、mustResetPassword。

强制改密用户只能访问 session、password change 和 logout。

## Authorization

每个 service 使用相同原则：

1. principal 必须存在。
2. platform admin 或 project member。
3. 根据角色形成能力。
4. 对象查询同时带 projectId。
5. 失败使用统一 404。

能力至少区分 read、edit、admin、review、publish、operate。

## Project Lifecycle

### Create

- 仅 platform admin。
- 校验稳定 ID、名称和模板。
- 创建空 published 和 draft。
- 授予创建者 project_admin。
- 不生成虚构任务或完成率。

### Edit

- 修改名称、模板化允许属性和展示配置。
- 模块配置只写 draft。

### Archive/Restore

- 事务更新项目状态和审计。
- 归档项目不出现在默认活跃列表，但可恢复。
- 不删除材料、版本和审计。

## Member Management

- platform admin 可管理用户和所有成员。
- project admin 只管理本项目 editor/viewer。
- 删除最后一个 project admin 被阻止。
- disabled 用户不能继续创建会话。

## Project Creation Evolution

当前 Phase 10 已有三入口。Phase 11 计划让三入口统一经过可编辑 `ProjectSkeleton` 确认；该变化属于 UI/DTO 演进，不改变最终 `createProject` 事务。

## Audit

登录、退出、改密、用户状态、成员变更、项目创建/编辑/归档/恢复全部写追加式 audit event。

## Verification

- 登录成功/失败、限流、会话空闲/绝对过期。
- CSRF 缺失和错误。
- 四角色项目列表、详情和写操作矩阵。
- 跨项目统一 404。
- 最后管理员保护。
- 强制改密和退出后 Back。
