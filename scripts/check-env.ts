import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { loadValidatedEnv } from '../plugins/validate-env.ts'

try {
  const { values } = parseArgs({
    options: {
      mode: { type: 'string', short: 'm' },
      command: { type: 'string', default: 'dev' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    process.stdout.write(
      '用法 pnpm check:env [--mode <模式>] [--command dev|preview|build]\n'
        + '默认按 dev 校验 development。build 默认使用 production。\n',
    )
  } else {
    const { command } = values
    if (command !== 'dev' && command !== 'preview' && command !== 'build') {
      throw new Error('--command 应为 dev、preview 或 build。')
    }
    const mode = values.mode ?? (command === 'build' ? 'production' : 'development')
    loadValidatedEnv(
      { mode, command: command === 'build' ? 'build' : 'serve' },
      resolve(import.meta.dirname, '..'),
    )
    process.stdout.write(`[环境变量] .env.${mode}.local 校验通过。\n`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
