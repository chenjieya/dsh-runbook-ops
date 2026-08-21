# Runbook 格式说明

Runbook 是一个 YAML 文件，用来描述团队希望模型遵循的操作流程。

## 文件位置

默认目录：

```text
.dsh/runbooks/<id>.yml
.dsh/runbooks/<id>.yaml
```

文件名主体必须和 `id` 字段一致。

## 顶层字段

| 字段          | 必填 | 说明                                               |
| ------------- | ---- | -------------------------------------------------- |
| `id`          | 是   | runbook id，只能使用小写字母、数字和连字符         |
| `title`       | 是   | 显示标题                                           |
| `description` | 否   | 简短说明                                           |
| `risk`        | 否   | `low`、`medium`、`high`、`critical`，默认 `medium` |
| `inputs`      | 否   | 输入声明，供未来 UI 或更复杂流程使用               |
| `steps`       | 是   | 非空步骤数组                                       |
| `acceptance`  | 否   | 完成条件                                           |

## 步骤类型

| kind       | 必填字段  | 说明                               |
| ---------- | --------- | ---------------------------------- |
| `command`  | `command` | 描述建议执行的命令，不由本插件执行 |
| `read`     | `path`    | 描述需要读取的文件                 |
| `check`    | `text`    | 描述人工或模型需要确认的检查点     |
| `approval` | `message` | 描述必须向用户确认的审批点         |
| `note`     | `text`    | 记录流程提示或背景信息             |

## 完整示例

```yaml
id: release-preflight
title: Release preflight
description: Check the repository before publishing a release.
risk: medium
inputs:
  branch:
    description: Release branch name.
    required: true
steps:
  - id: status
    title: Check git status
    kind: command
    command: git status --short
    required: true
  - id: typecheck
    title: Run typecheck
    kind: command
    command: npm run typecheck
    required: true
  - id: approval
    title: Ask before release
    kind: approval
    message: Confirm release publication.
acceptance:
  - Working tree is clean.
  - Typecheck passes.
  - User approved release publication.
```

## 校验规则

- `id`、input id、step id 必须匹配 `^[a-z0-9][a-z0-9-]*$`。
- `steps` 必须是非空数组。
- step id 不能重复。
- 每种 step kind 必须提供对应字段。
- `acceptance` 如果存在，必须是非空字符串数组。
