# 变更记录

本项目遵循语义化版本思路记录重要变更。

## 0.1.0

首个社区开发版本。

### Added

- 新增 `runbook_list`、`runbook_read`、`runbook_start` 三个 Harness 工具。
- 新增 YAML runbook 解析和校验。
- 新增示例 runbook：发布预检、Bug 修复检查。
- 新增 Prettier、ESLint、TypeScript、Vitest、Husky、lint-staged、Commitlint 和 GitHub Actions。
- 新增 README、贡献指南、安全策略、行为准则、质量门禁、发布说明和路线图。

### Security

- 默认拒绝绝对路径 runbook root。
- 拒绝路径穿越形式的 runbook id。
- 插件只生成执行指导，不直接执行 runbook 命令。
