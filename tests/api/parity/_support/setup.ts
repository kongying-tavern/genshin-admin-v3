import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll } from 'vitest'
import { rawRequest } from './client'
import { cleanupAll } from './cleanup'
import { envStamp, REPORTS_DIR } from './env'

/**
 * 全局前置：真实环境探活。
 *
 * 与既有 tests/api/_support/backend.ts 的 `probeIntegration` + `describe.skipIf` 不同，
 * 这里**不允许跳过**：任何一套环境不可达都必须让该次运行失败，
 * 否则「Rust 后端没起来」会被误读成「行为已对齐」。
 */
beforeAll(async () => {
  const probe = await rawRequest({ method: 'GET', path: '/system/role/list', timeoutMs: 15_000 })
  if (!probe.ok || probe.networkError || probe.status === 0)
    throw new Error(
      `[parity] ${envStamp.env}(${envStamp.envFile} / ${envStamp.baseUrl}) 不可达：${probe.networkError ?? 'no response'}`,
    )

  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(REPORTS_DIR, `env-${envStamp.env}.json`),
    JSON.stringify({
      ...envStamp,
      probedAt: new Date().toISOString(),
      probeStatus: probe.status,
      probeStatusText: probe.statusText,
      note: '未携带凭据的探活响应；两端状态码差异本身即为比对项',
    }, null, 2),
  )
  console.log(`[parity] ${envStamp.env} <- ${envStamp.envFile} (${envStamp.baseUrl}) 探活 status=${probe.status}`)
}, 60_000)

afterAll(async () => {
  await cleanupAll()
}, 60_000)
