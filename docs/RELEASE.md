# 发布流程

本文档说明发布社区包前需要完成的检查。

## 发布前检查

```bash
npm run check
npm pack --dry-run
```

确认 `npm pack --dry-run` 输出包含：

- `LICENSE`
- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `CODE_OF_CONDUCT.md`
- `docs/**/*.md`
- `examples/**/*.yml`
- `lib/**/*.js` 和 `lib/**/*.d.ts`

## 版本号

- runbook 格式或工具输出字段变更：至少 minor。
- 修复解析、校验或文档问题：patch。
- 删除字段、改工具名或破坏旧配置：major。

## 发布命令

正式发布前先登录 npm，并确认包名可用。

```bash
npm publish --access public
```

发布后建议用一个干净目录重新安装并验证 Harness 能加载插件。
