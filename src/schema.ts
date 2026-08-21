/**
 * Runbook 公共类型与基础校验常量。
 *
 * 这些类型同时服务解析器、工具输出和测试。把 id、risk、step kind 放在单独文件中，
 * 可以避免文档、校验和工具 schema 各自维护一份容易漂移的字符串集合。
 */
import type { JsonValue } from '@deepseek-ai/dsh-tools'

/** runbook、input 和 step 的公开 id，只允许安全文件名字符。 */
export const RUNBOOK_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/

/** v1 支持的步骤类型；命令型步骤只描述命令，不由本插件执行。 */
export const STEP_KINDS = ['command', 'read', 'check', 'approval', 'note'] as const
export type RunbookStepKind = (typeof STEP_KINDS)[number]

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

/** 输入声明保持 JSON 兼容，便于未来透传到 Web UI 或远程 API。 */
export type RunbookInputSpec = Record<string, JsonValue>

export interface RunbookStep {
  id: string
  title: string
  kind: RunbookStepKind
  required: boolean
  command?: string
  path?: string
  message?: string
  text?: string
}

export interface RunbookSummary {
  id: string
  title: string
  description?: string
  risk: RiskLevel
  path: string
}

export interface RunbookDocument extends RunbookSummary {
  inputs: Record<string, RunbookInputSpec>
  steps: RunbookStep[]
  acceptance: string[]
}

export interface RunbookStartResult {
  id: string
  title: string
  risk: RiskLevel
  executionPlan: string
  steps: RunbookStep[]
  acceptance: string[]
}

export function assertRunbookId(id: string): void {
  if (!RUNBOOK_ID_PATTERN.test(id)) {
    throw new Error(`runbook id must match ${RUNBOOK_ID_PATTERN.source}: ${id}`)
  }
}
