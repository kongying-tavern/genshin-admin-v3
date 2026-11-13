import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 双环境运行编排：Java 与 Rust **串行**执行（两套后端共享同一个数据库，并行会互相污染），
 * 两端都跑完后再做离线 diff。任一端红灯不阻断另一端采集，保证比对数据完整。
 *
 * 用法：
 *   node tests/api/parity/run-parity.mjs                 # 两端 + 报告（报告模式，退出码 0）
 *   node tests/api/parity/run-parity.mjs --strict       # 有红灯或 P0 差异时退出码 1
 *   node tests/api/parity/run-parity.mjs --env=java     # 只跑一端
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
process.chdir(ROOT)

const strict = process.argv.includes('--strict')
const only = process.argv.find(arg => arg.startsWith('--env='))?.slice('--env='.length)
const modes = only === 'java' ? ['parity-java'] : only === 'rust' ? ['parity-rust'] : ['parity-java', 'parity-rust']

if (Number(process.versions.node.split('.')[0]) < 24)
  console.warn('[parity] 当前 Node < 24，项目 package.json 要求 >=24；Vite 8 / Vitest 5 可能无法启动')

const results = []
for (const mode of modes) {
  console.log(`\n========== 采集 ${mode} ==========`)
  // 直接用当前 Node 执行 vitest 的 ESM 入口，绕开 Windows 下 pnpm.cmd / .ps1 的查找差异
  const vitestBin = path.join(ROOT, 'node_modules/vitest/vitest.mjs')
  const direct = fs.existsSync(vitestBin)
  const runner = direct ? process.execPath : (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm')
  const args = direct
    ? [vitestBin, 'run', '--config', 'vitest.parity.config.ts', '--mode', mode]
    : ['exec', 'vitest', 'run', '--config', 'vitest.parity.config.ts', '--mode', mode]
  const run = spawnSync(runner, args, { stdio: 'inherit', cwd: ROOT })
  if (run.error) console.error(`[parity] ${mode} 启动失败：${run.error.message}`)
  results.push({ mode, code: run.status ?? 1 })
}

console.log('\n========== 离线比对（Java 基准） ==========')
const diff = spawnSync(process.execPath, [path.join(ROOT, 'tests/api/parity/diff-report.mjs')], {
  stdio: 'inherit',
  cwd: ROOT,
})

let p0 = 0
try {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/api/parity/_reports/parity-result.json'), 'utf8'))
  p0 = report.counts.p0
} catch {
  console.warn('[parity] 未能读取比对结果，strict 模式将按「未通过」处理')
  p0 = Number.POSITIVE_INFINITY
}

const failed = results.filter(item => item.code !== 0)
console.log('\n========== 汇总 ==========')
for (const item of results) console.log(`  ${item.mode}: exit=${item.code}`)
console.log(`  不一致项 P0: ${p0}`)
console.log(`  报告目录: tests/api/parity/_reports/`)

if (strict && (failed.length || diff.status !== 0 || p0 > 0)) {
  console.error('[parity] strict 模式：存在用例红灯或 P0 差异，判定不放行')
  process.exit(1)
}
