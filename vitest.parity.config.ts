import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Java / Rust 双环境行为对齐测试配置（独立于 vitest.config.ts，不影响既有 unit / contract 与 CI）
 *
 * 用户授权的两套真实开发环境：
 *   --mode parity-java  -> .env.development.local       (Java 基准)
 *   --mode parity-rust  -> .env.development.rust.local  (Rust 待对齐)
 *
 * 为什么按文件名精确读取，而不是依赖 Vite 的隐式 env 加载：
 *   1. vitest 默认以 `test` mode 启动，只会加载 .env.test(.local)，与本次两套 dev 环境无关；
 *   2. `.env.development.rust.local` 不是 Vite 的标准 mode 文件名，隐式加载易错且来源不可标注；
 *   3. 每条观测结果都必须能追溯到「来自哪个 env 文件」，因此显式读文件并记录文件名。
 *
 * 凭据只在进程内通过 test.env 注入 worker，不写入任何产物、不打印、不进入报告。
 * 本配置不发起任何网络请求；探活在 tests/api/parity/_support/setup.ts 中完成。
 */

const ROOT = path.dirname(fileURLToPath(import.meta.url))

export const PARITY_ENV_FILES = {
  java: '.env.development.local',
  rust: '.env.development.rust.local',
} as const

export type ParityEnvName = keyof typeof PARITY_ENV_FILES

export type ParityEnvSpec = {
  name: ParityEnvName
  envFile: string
  baseUrl: string
  wsBase: string
  basicUser: string
  basicPassword: string
  username: string
  password: string
}

/** 解析 `KEY = 'value'` / `KEY=value` 形式，忽略注释行 */
export function parseEnvFile(file: string): Record<string, string> {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full))
    throw new Error(`[parity] 缺少已授权的环境文件 ${file}，无法连接真实开发环境`)

  const out: Record<string, string> = {}
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const matched = line.match(/^\s*([A-Za-z_][\w.]*)\s*=\s*(.*?)\s*$/)
    if (!matched) continue
    let value = matched[2]
    if (
      value.length >= 2
      && ((value[0] === "'" && value.at(-1) === "'") || (value[0] === '"' && value.at(-1) === '"'))
    )
      value = value.slice(1, -1)
    out[matched[1]] = value
  }
  return out
}

export function resolveParityEnv(name: ParityEnvName): ParityEnvSpec {
  const envFile = PARITY_ENV_FILES[name]
  const raw = parseEnvFile(envFile)

  // dev 环境的 VITE_API_BASE 是反代理前缀（/api-dev），真实后端绝对地址在 PROXY_TARGET
  const baseUrl = raw.VITE_API_PROXY_TARGET
  const wsBase = raw.VITE_WS_BASE
  const username = raw.VITE_TEST_USERNAME || raw.VITE_AUTO_COMPLETE_USERNAME
  const password = raw.VITE_TEST_PASSWORD || raw.VITE_AUTO_COMPLETE_PASSWORD

  const missing = Object.entries({
    VITE_API_PROXY_TARGET: baseUrl,
    VITE_WS_BASE: wsBase,
    VITE_API_AUTH_USERNAME: raw.VITE_API_AUTH_USERNAME,
    VITE_API_AUTH_PASSWORD: raw.VITE_API_AUTH_PASSWORD,
    'VITE_TEST_USERNAME|VITE_AUTO_COMPLETE_USERNAME': username,
    'VITE_TEST_PASSWORD|VITE_AUTO_COMPLETE_PASSWORD': password,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length)
    throw new Error(`[parity] ${envFile} 缺少必需配置：${missing.join(', ')}`)

  return {
    name,
    envFile,
    baseUrl,
    wsBase,
    basicUser: raw.VITE_API_AUTH_USERNAME,
    basicPassword: raw.VITE_API_AUTH_PASSWORD,
    username,
    password,
  }
}

export default defineConfig(({ mode }) => {
  const name: ParityEnvName = mode === 'parity-rust' ? 'rust' : 'java'
  const spec = resolveParityEnv(name)

  // 只输出环境标识与地址，绝不输出凭据值
  console.log(`[parity] env=${spec.name} envFile=${spec.envFile} base=${spec.baseUrl} ws=${spec.wsBase}`)

  return {
    test: {
      name: `parity-${name}`,
      // 全部走原生 fetch + socket.io-client，不需要 jsdom
      environment: 'node',
      include: ['tests/api/parity/cases/**/*.test.ts'],
      setupFiles: ['./tests/api/parity/_support/setup.ts'],
      env: {
        PARITY_ENV: spec.name,
        PARITY_ENV_FILE: spec.envFile,
        PARITY_API_BASE: spec.baseUrl,
        PARITY_WS_BASE: spec.wsBase,
        PARITY_BASIC_USER: spec.basicUser,
        PARITY_BASIC_PASSWORD: spec.basicPassword,
        PARITY_USERNAME: spec.username,
        PARITY_PASSWORD: spec.password,
      },
      // Java 与 Rust 共享同一个数据库（已由副作用探测证实），文件级并行会互相污染
      fileParallelism: false,
      testTimeout: 90_000,
      hookTimeout: 90_000,
      restoreMocks: true,
      passWithNoTests: false,
    },
  }
})
