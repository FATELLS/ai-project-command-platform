# G03 Plan: Workspace Walking Skeleton

## Approach

1. 创建 V2 目标目录树（apps/api, apps/web, packages/*, tests/, ops/）
2. 根 package.json 转为 workspace root，V1 脚本加 `v1:` 前缀
3. 写 tsconfig.base.json（strict, NodeNext）
4. 每个 workspace 写 package.json + tsconfig.json + 骨架入口
5. 写 verify-structure.mjs 验证目录结构合规
6. 验证通过后提交

## Allowed

- 根配置文件
- apps/api 最小 health skeleton
- apps/web 最小页面 skeleton
- packages/* 空但有职责的入口
- CI 配置
- 开发工具配置

## Forbidden

- 复制现有业务到新目录
- 正式切流
- 创建空洞层级
