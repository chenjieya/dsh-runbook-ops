# 质量门禁

本项目的质量门禁面向 GitHub 社区协作：本地可复现，CI 可复现，发布包内容可检查。

## 本地门禁

```bash
npm run check
```

该命令会串行执行：

1. `npm run format:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`

## 提交前校验

安装 hooks：

```bash
npm run hooks:install
```

`.husky/pre-commit` 会执行格式、lint、类型和测试校验。`.husky/commit-msg` 会执行 commitlint。

## 提交信息

使用 Conventional Commits：

```text
feat: add approval step support
fix: reject malformed runbook inputs
docs: update release guide
```

## CI

GitHub Actions 在 `push` 和 `pull_request` 时执行：

```bash
npm ci
npm run check
npm pack --dry-run
```

`npm pack --dry-run` 用来确认 README、许可证、贡献文档、示例和构建产物会进入 npm 发布包。
