# 贡献指南

感谢你愿意改进 dsh-runbook-ops。这个项目面向 DeepSeek Harness 社区，欢迎提交能让团队 SOP 更容易被模型正确执行和审计的改动。

## 可以贡献什么

- Runbook schema：字段、步骤类型、校验规则。
- 文档：使用案例、迁移说明、常见问题。
- 示例：发布检查、故障排查、测试流程、运维巡检。
- 测试：解析器、边界输入、真实 Harness 加载流程。
- 工程基建：CI、lint、发布检查、编辑器体验。

## 设计原则

- 不在插件内直接执行 shell，命令执行应继续使用 Harness 已有工具。
- 默认只读取当前会话工作区内的 runbook。
- 任何扩大读取范围或执行范围的能力都必须显式配置，并写清安全影响。
- 工具返回结构化 JSON，同时提供模型可读的 render 文本。
- 测试要覆盖失败路径，不只覆盖成功路径。

## 本地开发流程

```bash
npm install
npm run hooks:install
npm run check
npm pack --dry-run
```

`npm run check` 会依次执行格式校验、ESLint、TypeScript 类型检查、单元测试和构建。

## 提交信息

本项目使用 Conventional Commits，提交信息会由 commitlint 校验。

推荐格式：

```text
feat: add approval step support
fix: reject malformed runbook inputs
docs: document release preflight example
```

## Pull Request 要求

提交 PR 前请确认：

- 已说明这次变更解决什么问题。
- 已说明是否影响 runbook 格式、工具名称、输出字段或安装方式。
- 已运行 `npm run check`。
- 发布相关变更已运行 `npm pack --dry-run`。
- 安全边界变更已同步更新 [SECURITY.md](SECURITY.md)。

## 不建议的改动

- 在插件内直接执行命令。
- 默认读取项目目录之外的文件。
- 为了省事跳过 schema 校验。
- 引入运行时依赖但没有说明必要性和替代方案。
