// @ts-check

import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const tsFiles = ['src/**/*.ts', 'tests/**/*.ts']
const parser = /** @type {import('eslint').Linter.Parser} */ (/** @type {unknown} */ (tsParser))
const plugin = /** @type {import('eslint').ESLint.Plugin} */ (/** @type {unknown} */ (tsPlugin))

/**
 * ESLint flat config。
 *
 * 这里不用 typescript-eslint 聚合包，是为了让编辑器和 CI 都能直接解析到
 * @typescript-eslint/parser 与 @typescript-eslint/eslint-plugin 的类型定义。
 * 类型感知规则只作用于 TS 源码和测试文件，避免 eslint.config.js 自身被错误地按
 * TypeScript project 文件处理。
 *
 * @type {import('eslint').Linter.Config[]}
 */
const config = [
  {
    ignores: ['lib/**', 'node_modules/**', 'coverage/**', '*.tgz'],
  },
  {
    files: ['*.js'],
    ...js.configs.recommended,
  },
  {
    files: tsFiles,
    languageOptions: {
      parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: root,
      },
    },
    plugins: {
      '@typescript-eslint': plugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs['recommended-type-checked'].rules,
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
]

export default config
