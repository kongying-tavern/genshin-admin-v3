import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** 当前 worker 所属环境。由 vitest.parity.config.ts 的 test.env 注入。 */
const must = (key: string): string => {
  const value = process.env[key]
  if (!value)
    throw new Error(`[parity] 缺少 ${key}，请通过 test:parity:java / test:parity:rust 启动，不要直接跑 vitest`)
  return value
}

export type ParityEnvName = 'java' | 'rust'

export const parityEnv = must('PARITY_ENV') as ParityEnvName
export const envFile = must('PARITY_ENV_FILE')
export const apiBase = must('PARITY_API_BASE').replace(/\/$/, '')
export const wsBase = must('PARITY_WS_BASE')

export const basicCredentials = {
  username: must('PARITY_BASIC_USER'),
  password: must('PARITY_BASIC_PASSWORD'),
}

export const testAccount = {
  username: must('PARITY_USERNAME'),
  password: must('PARITY_PASSWORD'),
}

/** 本次运行的唯一标识：所有测试数据的命名前缀，便于识别与兜底回收 */
export const runId = `parity_${parityEnv}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`

/** 测试数据统一前缀。共享数据库下，两端前缀不同，互不干扰。 */
export const testPrefix = `__${runId}_`

export const ROOT = process.cwd()
export const REPORTS_DIR = path.join(ROOT, 'tests/api/parity/_reports')
export const SNAPSHOT_DIR = path.join(REPORTS_DIR, 'snapshots', parityEnv)

/** 每条观测结果都带上的环境溯源信息 */
export const envStamp = {
  env: parityEnv,
  envFile,
  baseUrl: apiBase,
  wsBase,
  runId,
  // 已由副作用探测证实：Java 建地区 id=689 在 Rust 可见、Rust 建 id=690 在 Java 可见。
  // 共享数据库意味着差异可能来自执行顺序 / 状态残留，不得直接归因于实现差异。
  sharedDatabase: true,
  sharedDatabaseEvidence:
    '副作用探测：Java 创建地区在 Rust 可查询到、Rust 创建地区在 Java 可查询到（同一数据库）',
}

fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
