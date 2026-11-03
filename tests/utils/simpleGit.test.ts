import { execFileSync, spawnSync } from 'node:child_process'
import { simpleGit } from 'simple-git'
import { describe, expect, it } from 'vitest'

/**
 * simple-git 行为基线
 *
 * `vite.config.ts` 依赖 simple-git 读取当前分支与提交哈希，并直接注入到
 * `import.meta.env.APP_BRANCH` / `APP_COMMIT_HASH`。这里的用例锁定该用法所依赖的
 * 外部行为，用于 3.27.0 → 4.0.1 升级前后的对比：
 *
 * - 必须存在具名导出 `simpleGit`（v4 移除了默认导出）
 * - `revparse` 返回的是**已去除首尾空白**的字符串（否则注入的常量会带换行）
 * - 命令失败时必须 reject，并把 git 的 stderr 透出到错误信息里
 */
const gitCli = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' })

/** 取 git 命令失败时的 stderr，作为 simple-git 错误信息的对照基准 */
const gitCliStderr = (...args: string[]) =>
  spawnSync('git', args, { encoding: 'utf8' }).stderr.trim()

describe('simple-git 行为基线', () => {
  const git = simpleGit()

  it('提供 simpleGit 工厂函数', () => {
    expect(typeof simpleGit).toBe('function')
  })

  it('checkIsRepo 识别当前目录为 git 仓库', async () => {
    await expect(git.checkIsRepo()).resolves.toBe(true)
  })

  it('revparse --abbrev-ref HEAD 返回与命令行一致的分支名，且不含空白', async () => {
    const branch = await git.revparse(['--abbrev-ref', 'HEAD'])

    expect(branch).toBe(gitCli('rev-parse', '--abbrev-ref', 'HEAD').trim())
    // 换行若未被裁剪，注入的 APP_BRANCH 会变成 `"dev\n"`
    expect(branch).toBe(branch.trim())
    expect(branch).not.toMatch(/[\r\n]/)
  })

  it('revparse --short HEAD 返回与命令行一致的短哈希，且已 trim', async () => {
    const hash = await git.revparse(['--short', 'HEAD'])

    expect(hash).toBe(gitCli('rev-parse', '--short', 'HEAD').trim())
    expect(hash).toMatch(/^[0-9a-f]{4,40}$/)
  })

  it('status().current 与 revparse 得到的分支名一致', async () => {
    const [branch, status] = await Promise.all([
      git.revparse(['--abbrev-ref', 'HEAD']),
      git.status(),
    ])

    expect(status.current).toBe(branch)
  })

  it('命令失败时 reject，并透出 git 的 stderr', async () => {
    const missingRef = 'refs/heads/__not_exist_branch__'

    const error = await git.revparse(['--verify', missingRef]).then(
      () => null,
      (reason: unknown) => reason as Error,
    )

    expect(error).toBeInstanceOf(Error)
    expect(error?.message.trim()).toBe(gitCliStderr('rev-parse', '--verify', missingRef))
  })
})
