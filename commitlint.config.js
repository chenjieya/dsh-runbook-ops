// @ts-check

/**
 * Commitlint 配置。
 *
 * 使用 Conventional Commits 是为了让社区贡献的提交历史可读，并方便后续自动生成
 * changelog。这里只声明规则来源，不在本仓库重新发明提交类型。
 *
 * @type {import('@commitlint/types').UserConfig}
 */
const config = {
  extends: ['@commitlint/config-conventional'],
}

export default config
