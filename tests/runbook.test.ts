/**
 * Runbook 解析器单元测试。
 *
 * 测试覆盖 v1 最重要的用户可见行为：正常读取、路径安全、重复步骤拒绝，以及
 * runbook_start 只返回执行指导。它不 mock 文件系统，因为目录解析就是插件行为的一部分。
 */
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listRunbooks, readRunbook, startRunbook, type RuntimeConfig } from '../src/runbook.js'

// 测试使用与默认插件配置一致的相对 runbook 目录，覆盖最常见的项目内使用方式。
const CONFIG: RuntimeConfig = { root: '.dsh/runbooks', maxBytes: 65536, allowAbsoluteRoot: false }

/**
 * 为每个用例创建独立临时工作区。
 *
 * 这样测试不会读取开发机器上的真实仓库文件，也能验证插件确实是按 Harness 会话 cwd
 * 解析相对路径，而不是按插件安装目录解析。
 */
async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-runbook-ops-'))
  await mkdir(join(root, '.dsh', 'runbooks'), { recursive: true })
  return root
}

describe('runbook parser', () => {
  it('lists and reads valid runbooks', async () => {
    const cwd = await workspace()
    await writeFile(
      join(cwd, '.dsh', 'runbooks', 'release-preflight.yml'),
      'id: release-preflight\ntitle: Release preflight\nsteps:\n  - id: status\n    title: Status\n    kind: command\n    command: git status --short\n',
    )

    // 列表接口应该给模型一个干净目录视图：合法文件进入 runbooks，坏文件进入 diagnostics。
    await expect(listRunbooks(CONFIG, { cwd })).resolves.toMatchObject({
      runbooks: [{ id: 'release-preflight', title: 'Release preflight', risk: 'medium' }],
      diagnostics: [],
    })
    // 读取接口返回完整步骤，后续 runbook_start 会基于同一个结构生成执行指导。
    await expect(readRunbook(CONFIG, { cwd }, 'release-preflight')).resolves.toMatchObject({
      id: 'release-preflight',
      steps: [{ id: 'status', kind: 'command', command: 'git status --short' }],
    })
  })

  it('rejects path traversal ids', async () => {
    const cwd = await workspace()
    // runbook id 同时是文件名主体，必须拒绝 ../ 这类路径穿越输入。
    await expect(readRunbook(CONFIG, { cwd }, '../secret')).rejects.toThrow(/runbook id/)
  })

  it('rejects duplicate step ids', async () => {
    const cwd = await workspace()
    await writeFile(
      join(cwd, '.dsh', 'runbooks', 'bad.yml'),
      'id: bad\ntitle: Bad\nsteps:\n  - id: same\n    title: A\n    kind: note\n    text: A\n  - id: same\n    title: B\n    kind: note\n    text: B\n',
    )

    // 步骤 id 会出现在执行报告和错误定位里，重复 id 会让排障证据不可追踪。
    await expect(readRunbook(CONFIG, { cwd }, 'bad')).rejects.toThrow(/duplicate step id/)
  })

  it('renders execution guidance without executing commands', async () => {
    const cwd = await workspace()
    await writeFile(
      join(cwd, '.dsh', 'runbooks', 'release-preflight.yml'),
      'id: release-preflight\ntitle: Release preflight\nsteps:\n  - id: typecheck\n    title: Typecheck\n    kind: command\n    command: pnpm run typecheck\nacceptance:\n  - Typecheck passes.\n',
    )

    const runbook = await readRunbook(CONFIG, { cwd }, 'release-preflight')
    // v1 的安全边界是“只生成指导，不执行命令”，避免绕过 Harness 现有审批和审计链路。
    expect(startRunbook(runbook).executionPlan).toContain('this runbook tool does not execute commands itself')
  })
})
