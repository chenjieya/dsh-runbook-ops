# dsh-runbook-ops

中文社区版 DeepSeek Harness runbook 插件。它把团队的开发、测试、发布和运维流程写成结构化 YAML，并以 Harness 工具的形式提供给模型使用。

这个插件的重点不是替代 Harness 的执行系统，而是把团队 SOP 变成可校验、可复用、可审计的执行指导。

## 功能

- `runbook_list`：列出当前项目中的 runbook。
- `runbook_read`：读取并校验指定 runbook。
- `runbook_start`：生成按步骤执行的模型指导文本。
- 默认只读取当前会话工作区内的 `.dsh/runbooks`。
- 不直接执行 shell 命令，命令执行继续交给 Harness 现有工具、审批和日志系统。

## 安装

发布后可通过 DeepSeek Harness 的插件机制安装：

```bash
dsh plugin --profile web add dsh-runbook-ops
```

本地开发时可在 DeepSeek Harness 仓库中加载 patch：

```bash
pnpm dsh web --patch C:/Users/admin/Desktop/code/dsh-runbook-ops/cordis.dev.yml
```

Headless 验证：

```bash
pnpm dsh --profile headless --patch C:/Users/admin/Desktop/code/dsh-runbook-ops/cordis.dev.yml "按 release-preflight runbook 检查当前项目"
```

> 这里的绝对路径只是本地开发示例。发布后的社区用户应使用自己的插件安装路径或 npm 包。

## Runbook 示例

默认目录：

```text
.dsh/runbooks/*.yml
.dsh/runbooks/*.yaml
```

示例文件：

```yaml
id: release-preflight
title: Release preflight
risk: medium
steps:
  - id: typecheck
    title: Run TypeScript typecheck
    kind: command
    command: pnpm run typecheck
    required: true
acceptance:
  - Typecheck passes.
```

完整格式见 [Runbook 格式说明](docs/RUNBOOK_SPEC.md)。

## 配置

```yaml
- insert:
    - id: runbook-ops
      name: dsh-runbook-ops
      config:
        root: .dsh/runbooks
        maxBytes: 65536
        allowAbsoluteRoot: false
```

| 字段                | 默认值          | 说明                              |
| ------------------- | --------------- | --------------------------------- |
| `root`              | `.dsh/runbooks` | 相对当前会话工作区的 runbook 目录 |
| `maxBytes`          | `65536`         | 单个 runbook 最大读取字节数       |
| `allowAbsoluteRoot` | `false`         | 是否允许绝对路径 root             |

## 开发

```bash
npm install
npm run hooks:install
npm run check
npm pack --dry-run
```

详细说明见 [开发指南](docs/DEVELOPMENT.md) 和 [质量门禁](docs/QUALITY.md)。

## 社区文档

- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)
- [行为准则](CODE_OF_CONDUCT.md)
- [变更记录](CHANGELOG.md)
- [开发指南](docs/DEVELOPMENT.md)
- [质量门禁](docs/QUALITY.md)
- [发布流程](docs/RELEASE.md)
- [路线图](docs/ROADMAP.md)

## 许可证

本项目使用 [MIT License](LICENSE)。
