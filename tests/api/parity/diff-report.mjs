import fs from 'node:fs'
import path from 'node:path'

/**
 * 双环境行为比对引擎（离线，不发任何网络请求）
 *
 * 输入：_reports/snapshots/java/*.json 与 _reports/snapshots/rust/*.json
 * 基准：Java（.env.development.local）实测；Rust（.env.development.rust.local）为待对齐方。
 * 口径：Java 实测即基准，包含其已知「非理想行为」；业务正确性另设参考栏，不参与对齐判定。
 *
 * 严格比对：状态码 / statusText / content-type / 响应头 / 响应体字段路径与类型 / 错误码 / 消息 / WS 事件
 * 信息级（不判不一致）：字段顺序、数组长度、耗时、runId、时间戳
 */

const ROOT = process.cwd()
const SNAP = path.join(ROOT, 'tests/api/parity/_reports/snapshots')
const OUT = path.join(ROOT, 'tests/api/parity/_reports')

const ENV_FILE = { java: '.env.development.local', rust: '.env.development.rust.local' }

const load = env => {
  const dir = path.join(SNAP, env)
  if (!fs.existsSync(dir)) return {}
  const out = {}
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.json'))) {
    try {
      const obs = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
      out[obs.caseId] = obs
    } catch (error) {
      console.warn(`[diff] 跳过损坏快照 ${env}/${file}: ${error.message}`)
    }
  }
  return out
}

const java = load('java')
const rust = load('rust')
const caseIds = [...new Set([...Object.keys(java), ...Object.keys(rust)])].sort()

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const short = v => {
  const s = JSON.stringify(v)
  return s === undefined ? String(v) : s.length > 240 ? `${s.slice(0, 240)}…` : s
}

/** 结构化比对：先聚合「键集合差异」，再递归比较共有键，避免 users 字典产生上百条噪声 */
function compare(a, b, prefix, out) {
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a).sort()
    const kb = Object.keys(b).sort()
    const onlyA = ka.filter(k => !kb.includes(k))
    const onlyB = kb.filter(k => !ka.includes(k))
    if (onlyA.length || onlyB.length) {
      out.push({
        path: `${prefix}.<keys>`,
        kind: 'keys',
        java: onlyA.length ? onlyA : '(无)',
        rust: onlyB.length ? onlyB : '(无)',
      })
    }
    for (const k of ka.filter(k => kb.includes(k))) compare(a[k], b[k], `${prefix}.${k}`, out)
    return
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i++) compare(a[i], b[i], `${prefix}[${i}]`, out)
    if (a.length !== b.length)
      out.push({ path: `${prefix}.length`, kind: 'value', java: a.length, rust: b.length, infoOnly: true })
    return
  }
  if (a !== b) out.push({ path: prefix, kind: 'value', java: a, rust: b })
}

const STRICT_FIELDS = [
  ['response.status', '状态码'],
  ['response.statusText', '状态码文案'],
  ['response.contentType', '响应头'],
  ['response.headers', '响应头'],
  ['response.semantic', '响应体字段/类型/值'],
  ['response.errorFlag', '业务错误码'],
  ['response.errorStatus', '业务错误码'],
  ['response.message', '错误/消息文案'],
  ['frontend', '前端封装层可见行为'],
  ['request.bodyShape', '请求参数'],
  ['request.authMode', '请求参数'],
  ['request.method', '请求参数'],
  // request.path 可能包含每次运行新建的动态 id，归入「信息级」，不参与严格比对
]

const get = (obj, dotted) => dotted.split('.').reduce((v, k) => (v == null ? undefined : v[k]), obj)

function severityOf(fieldPath, category) {
  if (category === '快照缺失') return '高'
  if (category === '状态码' || category === '业务错误码' || category === 'WebSocket 事件' || category === '前端封装层可见行为')
    return '高'
  if (category === '响应体字段/类型/值') {
    // 顶层结构 / 键集合 / 会话有效期 = 阻断级；深层字段类型差异 = 一般
    if (fieldPath === 'response.semantic' || fieldPath.endsWith('.<keys>') || /expires_in|expiresin/i.test(fieldPath))
      return '高'
    return '中'
  }
  return '中'
}

const PRIORITY = { 高: 'P0', 中: 'P1', 低: 'P2' }

const IMPACT_HINT = [
  [/expires_in|expiresin/i, '会话有效期直接决定前端 token 过期判断与刷新时机'],
  [/\.headers|contentType|content-type/i, '响应头差异可能影响前端 content-type 判定、缓存与安全策略'],
  [/status/i, '状态码差异会使前端错误分支与登出逻辑走不同路径'],
  [/message|error/i, '错误码/文案差异会使前端提示与异常处理不一致'],
  [/users|iconTag|__array__|keys/i, '响应体字段集合差异会改变前端渲染数据结构'],
  [/ws|event/i, 'WS 事件差异会使前端实时刷新逻辑失效'],
]

const impactOf = p => IMPACT_HINT.find(([re]) => re.test(p))?.[1] ?? '前端可观测行为不一致，需按 Java 基准核对'

const cases = []
const allDifferences = []

for (const caseId of caseIds) {
  const j = java[caseId]
  const r = rust[caseId]
  const differences = []
  const info = []

  if (!j || !r) {
    differences.push({
      caseId,
      category: '快照缺失',
      path: '<case>',
      kind: 'missing',
      java: j ? '已采集' : '缺失',
      rust: r ? '已采集' : '缺失',
      severity: '高',
      priority: 'P0',
      impact: '仅单端有观测，该场景未形成双环境比对，不得判为已对齐',
    })
  } else {
    for (const [field, category] of STRICT_FIELDS) {
      const jv = get(j, field)
      const rv = get(r, field)
      if (jv === undefined && rv === undefined) continue
      const local = []
      compare(jv, rv, field, local)
      for (const d of local) {
        if (d.infoOnly) continue
        differences.push({
          caseId,
          category,
          path: d.path,
          kind: d.kind,
          java: d.java,
          rust: d.rust,
          severity: severityOf(d.path, category),
          priority: PRIORITY[severityOf(d.path, category)],
          impact: impactOf(`${field}.${d.path}`),
        })
      }
    }

    // WS 事件比对
    if (j.ws || r.ws) {
      const jw = j.ws ?? {}
      const rw = r.ws ?? {}
      const local = []
      compare(
        { connected: jw.connected, handshake: jw.handshake, events: jw.events ?? [] },
        { connected: rw.connected, handshake: rw.handshake, events: rw.events ?? [] },
        'ws',
        local,
      )
      for (const d of local) {
        if (d.infoOnly) continue
        differences.push({
          caseId,
          category: 'WebSocket 事件',
          path: d.path,
          kind: d.kind,
          java: d.java,
          rust: d.rust,
          severity: '高',
          priority: 'P0',
          impact: 'REST→WS 事件名、payload 或握手行为不一致，前端实时刷新逻辑会分叉',
        })
      }
    }

    // 信息级：字段顺序 / 数组长度 / 耗时
    if (JSON.stringify(j.response?.topKeyOrder) !== JSON.stringify(r.response?.topKeyOrder)) {
      info.push({ type: '字段顺序', java: j.response?.topKeyOrder, rust: r.response?.topKeyOrder })
    }
    const ja = j.response?.arrayLengths ?? {}
    const ra = r.response?.arrayLengths ?? {}
    for (const k of new Set([...Object.keys(ja), ...Object.keys(ra)])) {
      if (ja[k] !== ra[k]) info.push({ type: '数组长度', path: k, java: ja[k], rust: ra[k] })
    }
  }

  cases.push({
    caseId,
    tags: (j ?? r)?.tags ?? [],
    javaStatus: j?.response?.status ?? null,
    rustStatus: r?.response?.status ?? null,
    javaEnvFile: j?.envFile ?? ENV_FILE.java,
    rustEnvFile: r?.envFile ?? ENV_FILE.rust,
    differenceCount: differences.length,
    worstSeverity: differences.length ? (differences.some(d => d.severity === '高') ? '高' : differences.some(d => d.severity === '中') ? '中' : '低') : '—',
    differences,
    info,
  })
  allDifferences.push(...differences)
}

const order = { 高: 0, 中: 1, 低: 2 }
allDifferences.sort((a, b) => (order[a.severity] - order[b.severity]) || a.caseId.localeCompare(b.caseId) || a.path.localeCompare(b.path))

const counts = {
  totalCases: caseIds.length,
  matched: cases.filter(c => c.javaStatus !== null && c.rustStatus !== null).length,
  javaOnly: caseIds.filter(id => java[id] && !rust[id]).length,
  rustOnly: caseIds.filter(id => !java[id] && rust[id]).length,
  aligned: cases.filter(c => c.differenceCount === 0).length,
  withDifferences: cases.filter(c => c.differenceCount > 0).length,
  differences: allDifferences.length,
  p0: allDifferences.filter(d => d.priority === 'P0').length,
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseline: 'Java / .env.development.local',
  candidate: 'Rust / .env.development.rust.local',
  principle: 'Java 实测即基准（含其已知非理想行为）；业务正确性另设参考栏，不参与对齐判定',
  counts,
  cases,
}
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'parity-result.json'), JSON.stringify(summary, null, 2))

// ---------- 双环境行为比对结果 ----------
const resultMd = [
  '# 双环境行为比对结果（Java 基准 → Rust）',
  '',
  `- 生成时间：${summary.generatedAt}`,
  `- 基准环境：**Java**，来源 \`${ENV_FILE.java}\``,
  `- 待对齐环境：**Rust**，来源 \`${ENV_FILE.rust}\``,
  `- 口径：${summary.principle}`,
  '- 数据来源：真实 HTTP / WebSocket 请求，无模拟数据；环境不可达一律判失败而非跳过',
  '- ⚠️ 数据隔离：副作用探测证实 **Java 与 Rust 共享同一数据库**（Java 建地区在 Rust 可见，反之亦然）。差异可能受执行顺序与状态残留影响，不得直接归因于实现差异；已用「独立 runId 前缀 + 两端串行执行 + 幂等清理」缓解',
  '- 验收口径：本报告只做「以 Java 为基准的行为比对」，不等同于 UAT 放行；差异分级处置与人工确认见最终审查报告',
  '',
  '## 概览',
  '',
  '| 指标 | 值 |',
  '|---|---|',
  `| 比对场景总数 | ${counts.totalCases} |`,
  `| 双端均有观测 | ${counts.matched} |`,
  `| 仅 Java 有观测 | ${counts.javaOnly} |`,
  `| 仅 Rust 有观测 | ${counts.rustOnly} |`,
  `| 完全一致的场景 | ${counts.aligned} |`,
  `| 存在不一致的场景 | ${counts.withDifferences} |`,
  `| 不一致项总数 | ${counts.differences} |`,
  `| 其中 P0 | ${counts.p0} |`,
  '',
  '## 逐场景比对',
  '',
  '| 场景 caseId | 标签 | Java status | Rust status | 差异数 | 最高严重度 |',
  '|---|---|---|---|---|---|',
  ...cases.map(c => `| \`${c.caseId}\` | ${c.tags.join(', ') || '—'} | ${c.javaStatus ?? '—'} | ${c.rustStatus ?? '—'} | ${c.differenceCount} | ${c.worstSeverity} |`),
  '',
  '> 每条观测的完整快照见 `snapshots/java/*.json` 与 `snapshots/rust/*.json`，均带 `env` / `envFile` / `baseUrl` / `capturedAt` 溯源字段。',
  '',
]
fs.writeFileSync(path.join(OUT, 'parity-result.md'), resultMd.join('\n'))

// ---------- 不一致项清单（同因聚合，避免共享库动态数据刷屏） ----------
const patternMap = new Map()
for (const d of allDifferences) {
  const key = `${d.category}|${d.path}|${short(d.java)}|${short(d.rust)}`
  const entry = patternMap.get(key) ?? { ...d, count: 0, cases: [] }
  entry.count += 1
  entry.cases.push(d.caseId)
  patternMap.set(key, entry)
}
const patterns = [...patternMap.values()].sort((a, b) =>
  (order[a.severity] - order[b.severity]) || b.count - a.count || a.path.localeCompare(b.path))
counts.patterns = patterns.length
fs.writeFileSync(path.join(OUT, 'parity-result.json'), JSON.stringify(summary, null, 2))

const diffMd = [
  '# 不一致项清单（以 Java 为基准）',
  '',
  `基准：Java / \`${ENV_FILE.java}\`　待对齐：Rust / \`${ENV_FILE.rust}\``,
  '',
  `逐场景差异 ${allDifferences.length} 项，聚合为 **${patterns.length} 类差异模式**（类别 + 字段路径 + 两端取值相同者合并）。`,
  '',
  '> 完整逐场景明细见 `parity-result.json` 的 `cases[].differences`；每条观测快照见 `snapshots/<env>/*.json`。',
  '',
  '## 差异模式汇总',
  '',
  '| # | 级别 | 类别 | 字段路径 | Java 值 | Rust 值 | 影响场景数 | 示例场景 |',
  '|---|---|---|---|---|---|---|---|',
]
if (!patterns.length) diffMd.push('| — | — | 本次比对未发现差异 | — | — | — | 0 | — |')
patterns.forEach((p, i) => {
  diffMd.push(`| D-${String(i + 1).padStart(3, '0')} | ${p.priority}/${p.severity} | ${p.category} | \`${p.path}\` | \`${short(p.java)}\` | \`${short(p.rust)}\` | ${p.count} | \`${p.cases[0]}\` |`)
})
diffMd.push('', '## P0 差异模式明细', '')
for (const p of patterns.filter(item => item.priority === 'P0')) {
  const no = String(patterns.indexOf(p) + 1).padStart(3, '0')
  diffMd.push(
    `### D-${no} ${p.category} — \`${p.path}\``,
    '',
    `- Java（\`${ENV_FILE.java}\`）：\`${short(p.java)}\``,
    `- Rust（\`${ENV_FILE.rust}\`）：\`${short(p.rust)}\``,
    `- 前端可观测影响：${p.impact}`,
    `- 影响场景 ${p.count} 个：${p.cases.slice(0, 8).map(c => `\`${c}\``).join('、')}${p.count > 8 ? ` 等共 ${p.count} 个` : ''}`,
    '',
  )
}
fs.writeFileSync(path.join(OUT, 'diff-list.md'), diffMd.join('\n'))

// ---------- 以 Java 为基准的前端断言修正项 ----------
const ASSERTION_SITES = [
  { match: /auth\.protected\.no-token/, site: 'tests/api/integration/auth-ladder.test.ts:31', current: "rejects.toThrow('Forbidden')", issue: '依赖 HTTP statusText 文案；Rust 侧无凭据返回 401 Unauthorized' },
  { match: /auth\.protected\.invalid-token/, site: 'tests/api/integration/auth-ladder.test.ts:47', current: "rejects.toThrow('Unauthorized')", issue: '依赖 statusText 文案，且未断言业务错误码 errorStatus' },
  { match: /auth\.login\.bad-password/, site: 'tests/api/integration/oauth.test.ts:36', current: "rejects.toThrow('Bad Request')", issue: '依赖 statusText 文案，未采集原始状态码与 error 字段' },
  { match: /auth\.login\.password|auth\.refresh/, site: 'tests/api/integration/oauth.test.ts:23-52', current: '仅断言 access_token 非空与 expiresTime > now', issue: '未断言 expires_in / token_type / scope / 响应头 / 字段类型；会话有效期差异会被漏掉' },
  { match: /response|schema|area|item|marker|icon/, site: 'tests/api/integration/*.test.ts（全部）', current: '经 alova responded 后仅断言解析数据', issue: '原始状态码、响应头、errorStatus、users 字典、字段类型均不可见' },
  { match: /ws|event/, site: 'src/api/ws/typings.d.ts / ModuleNetwork.vue', current: 'WSEventMap 未声明 MarkerLinkageDeleted', issue: '前端 WS 事件契约落后于 Java 后端广播，删除关联事件无法被类型系统覆盖' },
  { match: /.*/, site: 'tests/api/_support/backend.ts:23', current: 'probeIntegration + describe.skipIf', issue: '后端不可达时整体跳过会被误读为「已对齐」；双环境运行必须判失败' },
]
const touched = new Set()
const fixMd = [
  '# 以 Java 为基准的前端断言修正项',
  '',
  '> 原则：前端断言按 **Java 实测行为** 锁定，不迁就 Rust 的差异实现；差异应由比对报告暴露并推动后端对齐。',
  '',
  '## 一、现有断言必须修正的位置',
  '',
  '| # | 位置 | 现有断言 | 问题（基于真实双环境观测） | 修正方向 |',
  '|---|---|---|---|---|',
]
let fixNo = 0
for (const site of ASSERTION_SITES) {
  const hits = allDifferences.filter(d => site.match.test(d.caseId))
  if (!hits.length && site.match.source !== '.*') continue
  const key = site.site
  if (touched.has(key)) continue
  touched.add(key)
  fixNo += 1
  fixMd.push(`| ${fixNo} | \`${site.site}\` | \`${site.current}\` | ${site.issue} | 改为基于原始 \`status\` + \`errorStatus\` + \`message\` 的断言；补充响应头、字段类型与会话有效期断言；差异由 diff-list 裁决，不在单端断言里放宽 |`)
}
fixMd.push(
  '',
  '## 二、由本次差异自动推导的新增断言',
  '',
  '| # | 关联不一致项 | 建议新增的前端断言（Java 基准值） |',
  '|---|---|---|',
)
allDifferences.filter(d => d.priority === 'P0').slice(0, 60).forEach((d, i) => {
  fixMd.push(`| ${i + 1} | D-${String(allDifferences.indexOf(d) + 1).padStart(3, '0')} \`${d.path}\` | 锁定 Java 实测值 \`${short(d.java)}\`，在双环境用例中作为基线快照比对，禁止写成单端硬编码断言 |`)
})
fixMd.push(
  '',
  '## 三、断言写法约束',
  '',
  '1. 不再使用 `rejects.toThrow(statusText)` 作为唯一判据——alova `responded` 把 HTTP 错误转成 `Error(statusText)`，掩盖原始状态码与业务错误码。',
  '2. 需要观测原始响应时走 `tests/api/parity/_support/client.ts` 的 `rawRequest`，不要复用共享 alova 实例。',
  '3. 双环境用例只做「响应来自真实后端」的自洽断言，Java 基准值放在离线 diff 中裁决，避免单端红灯中断全量采集。',
  '4. 禁止 `describe.skipIf` 掩盖环境不可达；网络失败必须显式抛错。',
  '',
)
fs.writeFileSync(path.join(OUT, 'assertion-fixes.md'), fixMd.join('\n'))

// ---------- Java 基线偏差参考栏（不参与对齐判定） ----------
fs.writeFileSync(path.join(OUT, 'java-baseline-deviations.md'), [
  '# Java 基线偏差参考栏（业务正确性参考，不参与对齐判定）',
  '',
  '> 按已确认口径，Java 实测即唯一基准；以下条目只记录 Java 自身与业务期望的偏离，',
  '> **不得**据此把 Rust 的「修正」判为不一致，也**不得**写进门禁裁决。',
  '',
  '| # | 业务期望 | Java 实测行为 | 证据 |',
  '|---|---|---|---|',
  '| 1 | 地区树父子挂钩不能悬空 | 允许 `parentId` 指向不存在的父级，形成孤立地区，且无法被 -1 递归检索 | `tests/api/integration/area.test.ts:275-289`、`:30` |',
  '| 2 | 删除地区应级联清理该地区物品 | 后端 `deleteMarkerAndItemInArea` 误用地区 id 删物品，物品不会被删除，产生悬挂 `areaId` | `tests/api/integration/cross-entity.test.ts:148-151`、`:30-32` |',
  '| 3 | 删除被引用对象应阻止或级联 | 删除图标/物品分类不校验引用，物品保留悬空 `iconId` / 清空分类关联 | `tests/api/integration/cross-entity.test.ts:174-212` |',
  '| 4 | code 应唯一 | 重复 `code` 不阻止创建 | `tests/api/integration/area.test.ts:297-310` |',
  '| 5 | 删除不存在的点位应返回 404/业务错误 | 返回 500 | `tests/api/integration/marker.test.ts`（「删除不存在的点位返回 500」） |',
  '| 6 | REST 删除关联应有对应 WS 事件类型 | Java 广播 `MarkerLinkageDeleted`，但前端 `WSEventMap` 未声明 | `reference/.../MarkerLinkageController.java:74`、`src/api/ws/typings.d.ts` |',
  '',
].join('\n'))

console.log(`[diff] 场景 ${counts.totalCases} / 双端匹配 ${counts.matched} / 不一致项 ${counts.differences} (P0=${counts.p0})`)
console.log(`[diff] 产物：parity-result.md / parity-result.json / diff-list.md / assertion-fixes.md / java-baseline-deviations.md`)
