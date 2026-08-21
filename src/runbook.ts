/**
 * Runbook 读取、解析和执行指导生成逻辑。
 *
 * 这里是插件的核心安全层：它把 YAML 文件收敛成受控的 TypeScript 数据结构，拒绝
 * 路径穿越、重复步骤和缺失字段，并明确保持“只生成指导，不直接执行命令”的 v1 边界。
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { load } from 'js-yaml'
import {
  assertRunbookId,
  RISK_LEVELS,
  RUNBOOK_ID_PATTERN,
  STEP_KINDS,
  type RiskLevel,
  type RunbookDocument,
  type RunbookInputSpec,
  type RunbookStartResult,
  type RunbookStep,
  type RunbookStepKind,
  type RunbookSummary,
} from './schema.js'

/** 运行时配置来自 Cordis 插件配置，保持为普通 JSON 以便社区用户审查。 */
export interface RuntimeConfig {
  root: string
  maxBytes: number
  allowAbsoluteRoot: boolean
}

/** 当前 Harness 会话的工作区信息；没有 agent 会话时回退到进程 cwd。 */
export interface RunbookLocationContext {
  cwd?: string
}

const DEFAULT_RISK: RiskLevel = 'medium'
const RUNBOOK_EXTENSIONS = ['.yml', '.yaml'] as const

type JsonObject = Record<string, unknown>

/**
 * 解析 runbook 根目录。默认拒绝绝对路径，避免社区插件在未显式配置时越过项目目录读取文件。
 */
export function resolveRunbookRoot(config: RuntimeConfig, context: RunbookLocationContext): string {
  if (isAbsolute(config.root)) {
    if (!config.allowAbsoluteRoot) throw new Error('runbook root must be relative unless allowAbsoluteRoot is true')
    return resolve(config.root)
  }
  return resolve(context.cwd ?? process.cwd(), config.root)
}

/** 列出可解析的 runbook，并把单个坏文件转成诊断，避免一个错误文件挡住整个目录。 */
export async function listRunbooks(
  config: RuntimeConfig,
  context: RunbookLocationContext,
): Promise<{ root: string; runbooks: RunbookSummary[]; diagnostics: string[] }> {
  const root = resolveRunbookRoot(config, context)
  let entries: string[]
  try {
    entries = await readdir(root)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return { root, runbooks: [], diagnostics: [] }
    throw error
  }

  const runbooks: RunbookSummary[] = []
  const diagnostics: string[] = []
  for (const entry of entries.sort()) {
    const extension = RUNBOOK_EXTENSIONS.find((suffix) => entry.endsWith(suffix))
    if (extension === undefined) continue
    const id = entry.slice(0, -extension.length)
    if (!RUNBOOK_ID_PATTERN.test(id)) {
      diagnostics.push(`ignored ${entry}: file name must be a runbook id plus .yml or .yaml`)
      continue
    }
    try {
      const document = await readRunbook(config, context, id)
      runbooks.push({
        id: document.id,
        title: document.title,
        ...(document.description === undefined ? {} : { description: document.description }),
        risk: document.risk,
        path: document.path,
      })
    } catch (error) {
      diagnostics.push(`ignored ${entry}: ${messageOf(error)}`)
    }
  }
  return { root, runbooks, diagnostics }
}

/** 读取并校验一个 runbook；id 只能来自安全文件名，不能携带路径穿越片段。 */
export async function readRunbook(
  config: RuntimeConfig,
  context: RunbookLocationContext,
  id: string,
): Promise<RunbookDocument> {
  assertRunbookId(id)
  const root = resolveRunbookRoot(config, context)
  const path = await resolveRunbookPath(root, id)
  const info = await stat(path)
  if (info.size > config.maxBytes) {
    throw new Error(`runbook ${id} is ${info.size} bytes, exceeding maxBytes ${config.maxBytes}`)
  }
  const source = await readFile(path, 'utf8')
  return parseRunbook(source, path, id)
}

/** 生成模型执行提示，不直接运行 runbook 里的命令。 */
export function startRunbook(runbook: RunbookDocument): RunbookStartResult {
  return {
    id: runbook.id,
    title: runbook.title,
    risk: runbook.risk,
    executionPlan: renderExecutionPlan(runbook),
    steps: runbook.steps,
    acceptance: runbook.acceptance,
  }
}

async function resolveRunbookPath(root: string, id: string): Promise<string> {
  for (const extension of RUNBOOK_EXTENSIONS) {
    const candidate = join(root, `${id}${extension}`)
    try {
      const info = await stat(candidate)
      if (info.isFile()) return candidate
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error
    }
  }
  throw new Error(`runbook not found: ${id}`)
}

// YAML 来自项目文件，必须在进入工具输出前收敛成受控字段。
function parseRunbook(source: string, path: string, expectedId: string): RunbookDocument {
  let value: unknown
  try {
    value = load(source)
  } catch (error) {
    throw new Error(`invalid YAML: ${messageOf(error)}`)
  }
  if (!isRecord(value)) throw new Error('runbook root must be a mapping')

  const id = requiredString(value, 'id')
  assertRunbookId(id)
  if (id !== expectedId) throw new Error(`runbook id ${id} does not match file name ${expectedId}`)
  const title = requiredString(value, 'title')
  const description = optionalString(value, 'description')
  const risk = parseRisk(optionalString(value, 'risk'))
  const inputs = parseInputs(value.inputs)
  const steps = parseSteps(value.steps)
  const acceptance = parseStringArray(value.acceptance, 'acceptance')

  return {
    id,
    title,
    ...(description === undefined ? {} : { description }),
    risk,
    path,
    inputs,
    steps,
    acceptance,
  }
}

function parseRisk(raw: string | undefined): RiskLevel {
  if (raw === undefined) return DEFAULT_RISK
  if ((RISK_LEVELS as readonly string[]).includes(raw)) return raw as RiskLevel
  throw new Error(`risk must be one of ${RISK_LEVELS.join(', ')}`)
}

function parseInputs(value: unknown): Record<string, RunbookInputSpec> {
  if (value === undefined) return {}
  if (!isRecord(value)) throw new Error('inputs must be a mapping')
  const result: Record<string, RunbookInputSpec> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!RUNBOOK_ID_PATTERN.test(key)) throw new Error(`input id must match ${RUNBOOK_ID_PATTERN.source}: ${key}`)
    if (!isRecord(raw)) throw new Error(`input ${key} must be a mapping`)
    const description = optionalString(raw, 'description')
    result[key] = {
      ...(description === undefined ? {} : { description }),
      ...(raw.required === undefined ? {} : { required: booleanField(raw, 'required') }),
    }
  }
  return result
}

function parseSteps(value: unknown): RunbookStep[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('steps must be a non-empty array')
  const seen = new Set<string>()
  return value.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`steps[${index}] must be a mapping`)
    const id = requiredString(raw, 'id')
    assertRunbookId(id)
    if (seen.has(id)) throw new Error(`duplicate step id: ${id}`)
    seen.add(id)
    const kind = parseStepKind(requiredString(raw, 'kind'))
    const command = optionalString(raw, 'command')
    const filePath = optionalString(raw, 'path')
    const message = optionalString(raw, 'message')
    const text = optionalString(raw, 'text')
    const step: RunbookStep = {
      id,
      title: requiredString(raw, 'title'),
      kind,
      required: raw.required === undefined ? true : booleanField(raw, 'required'),
      ...(command === undefined ? {} : { command }),
      ...(filePath === undefined ? {} : { path: filePath }),
      ...(message === undefined ? {} : { message }),
      ...(text === undefined ? {} : { text }),
    }
    assertStepPayload(step)
    return step
  })
}

function parseStepKind(raw: string): RunbookStepKind {
  if ((STEP_KINDS as readonly string[]).includes(raw)) return raw as RunbookStepKind
  throw new Error(`step kind must be one of ${STEP_KINDS.join(', ')}`)
}

function assertStepPayload(step: RunbookStep): void {
  if (step.kind === 'command' && !step.command) throw new Error(`step ${step.id} command is required`)
  if (step.kind === 'read' && !step.path) throw new Error(`step ${step.id} path is required`)
  if (step.kind === 'approval' && !step.message) throw new Error(`step ${step.id} message is required`)
  if ((step.kind === 'check' || step.kind === 'note') && !step.text) throw new Error(`step ${step.id} text is required`)
}

function renderExecutionPlan(runbook: RunbookDocument): string {
  const lines = [
    `Runbook: ${runbook.title} (${runbook.id})`,
    `Risk: ${runbook.risk}`,
    '',
    'Execution rules:',
    '- Follow the steps in order unless the user explicitly changes the plan.',
    '- Use existing Harness tools for file reads, shell commands, approvals, and todos; this runbook tool does not execute commands itself.',
    '- Stop on a failed required step, summarize the failure, and ask before continuing.',
    '- Treat approval steps as mandatory user confirmation points.',
    '- Finish with evidence: commands run, files inspected, pass/fail status, and unresolved risks.',
    '',
    'Steps:',
  ]
  for (const [index, step] of runbook.steps.entries()) {
    lines.push(`${index + 1}. [${step.kind}] ${step.title} (${step.id})${step.required ? '' : ' optional'}`)
    if (step.command) lines.push(`   command: ${step.command}`)
    if (step.path) lines.push(`   path: ${step.path}`)
    if (step.message) lines.push(`   approval: ${step.message}`)
    if (step.text) lines.push(`   note: ${step.text}`)
  }
  if (runbook.acceptance.length > 0) {
    lines.push('', 'Acceptance:')
    for (const item of runbook.acceptance) lines.push(`- ${item}`)
  }
  return lines.join('\n')
}

function requiredString(record: JsonObject, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${key} must be a non-empty string`)
  return value
}

function optionalString(record: JsonObject, key: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`${key} must be a non-empty string when provided`)
  return value
}

function booleanField(record: JsonObject, key: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean`)
  return value
}

function parseStringArray(value: unknown, key: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`${key} must be an array of non-empty strings`)
  const items: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new Error(`${key} must be an array of non-empty strings`)
    }
    items.push(item)
  }
  return items
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
