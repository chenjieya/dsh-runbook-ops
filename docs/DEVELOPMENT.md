# 开发指南

本文档说明如何在本地开发和验证 dsh-runbook-ops。

## 环境要求

| 工具             | 要求                  |
| ---------------- | --------------------- |
| Node.js          | 22.19 或更高          |
| npm              | 跟随 Node.js 当前版本 |
| DeepSeek Harness | 源码仓库或已安装版本  |

## 安装依赖

```bash
npm install
npm run hooks:install
```

仓库包含 `.vscode/settings.json`，VS Code 会优先使用项目内 TypeScript SDK，减少全局 TS 版本不一致造成的误报。

## 常用命令

| 命令                   | 作用                                   |
| ---------------------- | -------------------------------------- |
| `npm run format`       | 格式化源码、文档和配置                 |
| `npm run format:check` | 只检查格式                             |
| `npm run lint`         | 执行 ESLint                            |
| `npm run typecheck`    | 检查源码、测试和 JS 配置文件类型       |
| `npm test`             | 执行 Vitest 单元测试                   |
| `npm run build`        | 使用 `tsconfig.build.json` 构建 `lib/` |
| `npm run check`        | 执行完整本地门禁                       |

## 本地加载插件

先在插件仓库构建，再到 DeepSeek Harness 仓库中执行：

```bash
cd C:/Users/admin/Desktop/code/dsh-runbook-ops
npm run build
cd C:/Users/admin/Desktop/code/deepseek-harness
pnpm dsh web --patch C:/Users/admin/Desktop/code/dsh-runbook-ops/cordis.dev.yml
```

Windows 本地开发时，`cordis.dev.yml` 里的插件入口使用 `file:///C:/.../lib/index.js`。这是 Node ESM loader 的要求；裸路径 `C:/.../lib/index.js` 会报 `Received protocol 'c:'`。这里加载构建后的 JS 产物，避免不同 DSH 启动方式对 `.ts` loader 支持不一致。`--patch` 参数本身可以继续使用普通路径。

Headless 验证：

```bash
pnpm dsh --profile headless --patch C:/Users/admin/Desktop/code/dsh-runbook-ops/cordis.dev.yml "列出当前项目 runbook"
```

## 测试重点

- 正常 runbook 能被列出和读取。
- 路径穿越 id 会被拒绝。
- 重复 step id 会被拒绝。
- `runbook_start` 只生成执行指导，不执行命令。
