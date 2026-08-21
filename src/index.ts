/**
 * Cordis 插件入口。
 *
 * 这个文件只负责把 runbook 能力注册成 DeepSeek Harness 工具，并声明插件配置。
 * 具体的文件读取、YAML 解析和安全校验放在 runbook.ts，避免工具注册代码混入业务细节。
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { listRunbooks, readRunbook, startRunbook, type RuntimeConfig } from './runbook.js'

export const name = 'runbook-ops'
export const inject = ['tools']

export interface Config {
  /** Runbook 目录，默认按当前 Harness 会话工作区解析。 */
  root?: string
  /** 单个 runbook 文件允许读取的最大字节数，用于限制误读大文件。 */
  maxBytes?: number
  /** 是否允许绝对路径目录；默认关闭，避免社区配置意外读取项目外文件。 */
  allowAbsoluteRoot?: boolean
}

export const Config: Schema<Config> = Schema.object({
  root: Schema.string().default('.dsh/runbooks'),
  maxBytes: Schema.number().step(1).min(1024).default(65536),
  allowAbsoluteRoot: Schema.boolean().default(false),
})

// 插件只注册读取和执行引导工具；真实命令仍交给 Harness 的工具、审批和日志系统处理。
export function apply(ctx: Context, config: Config): void {
  const runtime = resolveRuntimeConfig(config)

  ctx.tools.register(
    defineTool({
      name: 'runbook_list',
      description:
        'List project runbooks that define development, testing, release, or operations procedures for this repository.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            root: { type: 'string', required: true },
            runbooks: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string', required: true },
                  title: { type: 'string', required: true },
                  description: { type: 'string' },
                  risk: { type: 'string', required: true },
                  path: { type: 'string', required: true },
                },
              },
            },
            diagnostics: { type: 'array', required: true, items: { type: 'string' } },
          },
        },
        render: (_args, value) => [{ type: 'text', text: renderRunbookList(value) }],
      },
      isConcurrencySafe: () => true,
      async execute(_args, exec) {
        return listRunbooks(runtime, { cwd: exec.agent?.session.header.cwd })
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'runbook_read',
      description: 'Read and validate one project runbook by id. Use this before following a repository workflow.',
      parameters: {
        id: {
          type: 'string',
          required: true,
          description: 'Runbook id, matching its file name without .yml or .yaml.',
        },
      },
      output: {
        schema: runbookDocumentSchema(),
        render: (_args, value) => [{ type: 'text', text: renderRunbookDocument(value) }],
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        return readRunbook(runtime, { cwd: exec.agent?.session.header.cwd }, args.id)
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'runbook_start',
      description:
        'Turn a project runbook into execution guidance for the current agent. This does not execute commands; use existing tools and report evidence.',
      parameters: {
        id: {
          type: 'string',
          required: true,
          description: 'Runbook id, matching its file name without .yml or .yaml.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true },
            title: { type: 'string', required: true },
            risk: { type: 'string', required: true },
            executionPlan: { type: 'string', required: true },
            steps: runbookStepsSchema(),
            acceptance: { type: 'array', required: true, items: { type: 'string' } },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.executionPlan }],
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const runbook = await readRunbook(runtime, { cwd: exec.agent?.session.header.cwd }, args.id)
        return startRunbook(runbook)
      },
    }),
  )
}

function resolveRuntimeConfig(config: Config): RuntimeConfig {
  return {
    root: config.root ?? '.dsh/runbooks',
    maxBytes: config.maxBytes ?? 65536,
    allowAbsoluteRoot: config.allowAbsoluteRoot ?? false,
  }
}

function runbookDocumentSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string', required: true },
      title: { type: 'string', required: true },
      description: { type: 'string' },
      risk: { type: 'string', required: true },
      path: { type: 'string', required: true },
      inputs: { type: 'object', required: true, additionalProperties: true },
      steps: runbookStepsSchema(),
      acceptance: { type: 'array', required: true, items: { type: 'string' } },
    },
  } as const
}

function runbookStepsSchema() {
  return {
    type: 'array',
    required: true,
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', required: true },
        title: { type: 'string', required: true },
        kind: { type: 'string', required: true, enum: ['command', 'read', 'check', 'approval', 'note'] },
        required: { type: 'boolean', required: true },
        command: { type: 'string' },
        path: { type: 'string' },
        message: { type: 'string' },
        text: { type: 'string' },
      },
    },
  } as const
}

function renderRunbookList(value: {
  root: string
  runbooks: Array<{ id: string; title: string; risk: string }>
  diagnostics: string[]
}): string {
  const lines = [`Runbook root: ${value.root}`]
  if (value.runbooks.length === 0) lines.push('No valid runbooks found.')
  for (const runbook of value.runbooks) lines.push(`- ${runbook.id}: ${runbook.title} [risk: ${runbook.risk}]`)
  if (value.diagnostics.length > 0) {
    lines.push('', 'Diagnostics:')
    for (const diagnostic of value.diagnostics) lines.push(`- ${diagnostic}`)
  }
  return lines.join('\n')
}

function renderRunbookDocument(value: {
  id: string
  title: string
  risk: string
  steps: Array<{ id: string; title: string; kind: string }>
  acceptance: string[]
}): string {
  const lines = [`Runbook: ${value.title} (${value.id})`, `Risk: ${value.risk}`, '', 'Steps:']
  for (const [index, step] of value.steps.entries())
    lines.push(`${index + 1}. [${step.kind}] ${step.title} (${step.id})`)
  if (value.acceptance.length > 0) {
    lines.push('', 'Acceptance:')
    for (const item of value.acceptance) lines.push(`- ${item}`)
  }
  return lines.join('\n')
}
