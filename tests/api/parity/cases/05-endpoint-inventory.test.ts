import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { rawRequest } from '../_support/client'
import type { RawResult } from '../_support/client'
import { ROOT } from '../_support/env'
import { capture } from '../_support/observer'
import { getToken } from '../_support/session'

/**
 * ⑤ 端点可达性清单
 *
 * 运行时读取 src/api/alova/apiDefinitions.ts 并用正则解析全部端点，
 * 只挑 GET 与只读 POST（等价于排除 PUT / 全部 DELETE / 含写语义动词的 POST），
 * 对每个端点做一次真实请求，收集 status / contentType / 顶层键。
 *
 * 一个 it 内完成全部请求（分批并发，单请求 8s 超时，总数 ≤60），
 * 最后只调用一次 capture 汇总：
 *  - note：全量明细 JSON 字符串（按任务要求）；
 *  - response.message：逐端点一行的紧凑摘要。
 * 现有 diff-report.mjs 的 STRICT_FIELDS 含 response.message 而不含 note，
 * 因此摘要冗余承载在 message，确保端点级差异能被离线 diff 以 Java 为基线裁决。
 */

const SOURCE = path.join(ROOT, 'src/api/alova/apiDefinitions.ts')

/** 兼容单行与多行定义（多行数组在 path 后带尾随逗号） */
const DEFINITION_RE = /['"]([\w.]+)['"]\s*:\s*\[\s*['"](GET|POST|PUT|DELETE)['"]\s*,\s*['"]([^'"]+)['"]\s*,?\s*\]/g

type Endpoint = { key: string; method: string; template: string }

const parseEndpoints = (): Endpoint[] => {
  const source = fs.readFileSync(SOURCE, 'utf8')
  const out: Endpoint[] = []
  for (const m of source.matchAll(DEFINITION_RE)) {
    out.push({ key: m[1], method: m[2], template: m[3] })
  }
  return out
}

/** 只读 POST 的 path 特征：含 /get/，或以 list/info/data/list_all/userList 收尾 */
const isReadonlyPost = (p: string) =>
  /\/get\//.test(p)
  || /\/(list|info|data)(\/|$)/.test(p)
  || /\/list_all$|\/userList$/.test(p)

/** 写语义动词，仅作用于 path 末段，避免误伤 /api/marker_link/get/* 等只读端点 */
const WRITE_VERB = /(add|update|create|delete|link|save|tweak|push|consume|register|generate|rename|reject|pass|copy|join|move|kick|restore|clean|trigger|remove|upload|reset)/i

const isInventoryTarget = (e: Endpoint): boolean => {
  if (e.method === 'GET') return true
  if (e.method !== 'POST') return false // 排除全部 PUT 与 DELETE
  const last = e.template.split('/').pop() ?? ''
  return isReadonlyPost(e.template) && !WRITE_VERB.test(last)
}

type InventoryRow = {
  key: string
  method: string
  path: string
  status: number
  contentType: string | null
  topKeys: string[]
  ok: boolean
  networkError: string | null
}

describe('parity / 端点可达性清单', () => {
  it('inventory.endpoints：GET 与只读 POST 全量探活', async () => {
    const token = await getToken()
    const all = parseEndpoints()
    const targets = all.filter(isInventoryTarget).slice(0, 60)

    const rows: InventoryRow[] = []
    const BATCH = 8
    for (let i = 0; i < targets.length; i += BATCH) {
      const batch = targets.slice(i, i + BATCH)
      const settled = await Promise.all(batch.map(async (e) => {
        const requestPath = e.template.replace(/\{[^}]+\}/g, '1')
        const res = await rawRequest({
          method: e.method,
          path: requestPath,
          body: e.method === 'POST' ? {} : undefined,
          token,
          timeoutMs: 8000,
        })
        return { e, res }
      }))
      for (const { e, res } of settled) {
        const topKeys = Array.isArray(res.body)
          ? ['<array>']
          : (res.body !== null && typeof res.body === 'object'
              ? Object.keys(res.body).sort()
              : ['<scalar>'])
        rows.push({
          key: e.key,
          method: e.method,
          path: e.template,
          status: res.status,
          contentType: res.contentType ?? null,
          topKeys,
          ok: res.ok,
          networkError: res.networkError ?? null,
        })
      }
    }

    // 自洽断言：确实对真实后端发起并取得了一组响应（不写跨环境断言）
    expect(targets.length).toBeGreaterThan(0)
    expect(rows.length).toBe(targets.length)
    expect(rows.some(r => r.ok && r.status > 0)).toBe(true)

    const detail = JSON.stringify({
      source: 'src/api/alova/apiDefinitions.ts',
      totalParsed: all.length,
      sampled: rows.length,
      endpoints: rows,
    })
    const compact = rows
      .map(r => `${r.method} ${r.path} => ${r.status} ${r.contentType ?? '-'} [${r.topKeys.join(',')}]`)
      .join('\n')

    // 汇总载体：明细同时置于 note（JSON）与 response.message（紧凑摘要），
    // 保证不读 note 的离线 diff 也能逐端点裁决。
    const carrier: RawResult = {
      ok: true,
      status: 200,
      statusText: 'OK',
      contentType: 'application/json',
      headers: {},
      bodyText: compact,
      body: { message: compact },
      ms: 0,
    }

    const input = await capture('inventory.endpoints', ['endpoint-inventory'], async () => ({
      res: carrier,
      method: 'GET/POST',
      path: '(parsed from src/api/alova/apiDefinitions.ts: GET + readonly POST)',
      body: '(per-endpoint: GET none / POST {})',
      authMode: 'bearer-valid',
      note: detail,
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })
})
