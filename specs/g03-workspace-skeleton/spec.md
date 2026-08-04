# G03 Spec: Workspace Walking Skeleton

## Objective

按 accepted 目录创建最小 Node22/TypeScript/npm workspaces 骨架，完成 structure verification，但不迁移业务功能。

## Success Criteria

1. npm workspaces 配置完成（6 个 workspace）
2. TypeScript strict 配置完成（tsconfig.base.json）
3. 目标目录结构 100% 合规（verify-structure.mjs PASS）
4. 每个 workspace 有 package.json + tsconfig.json + 最小入口文件
5. V1 脚本仍可通过 `v1:*` 前缀运行
6. 旧应用未切换

## Failure

- 引入 Nx/Turbo
- 为了过 lint 全局 disable
- 新建无内容的所有模块文件（只有有职责的入口）
- 改变用户功能

## Forbidden

- 复制现有业务到新目录
- 正式切流
- 创建空洞层级
- 引入运行中间件
