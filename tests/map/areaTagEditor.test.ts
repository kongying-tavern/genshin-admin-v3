import type { AddressInfo } from 'node:net'
import type { ViteDevServer } from 'vite'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { areaTagEditor } from '../../plugins/area-tag-editor'

describe('开发服务器地区标签配置', () => {
  const areaCode = 'A:TEST:MAP'
  const siblingCode = 'A:TEST:OTHER'
  const original = [['旧标签', [11, -7], 1]]
  const sibling = [['同底图另一地区', [2, 3]]]
  let dir: string
  let file: string
  let origin: string
  let server: ViteDevServer

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'area-tag-editor-'))
    file = join(dir, 'src/configs/areaTags.json')
    await mkdir(dirname(file), { recursive: true })
    server = await createServer({
      root: dir,
      configFile: false,
      logLevel: 'silent',
      plugins: [areaTagEditor()],
      server: { host: '127.0.0.1', port: 0, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    })
    await server.listen()
    origin = `http://127.0.0.1:${(server.httpServer!.address() as AddressInfo).port}`
  })

  beforeEach(async () => {
    await writeFile(file, JSON.stringify({ [areaCode]: original, [siblingCode]: sibling }))
  })

  afterAll(async () => {
    await server?.close()
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  const save = (before: unknown[], tags: unknown[], requestOrigin = origin) =>
    fetch(`${origin}/__map_area_tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: requestOrigin },
      body: JSON.stringify({ areaCode, before, tags }),
    })

  const readTags = async () => JSON.parse(await readFile(file, 'utf8'))

  it('可新增、修改、删除标签并保留同底图的其他地区', async () => {
    const added = [...original, ['新增「标签」', [-1.25, 17.5]]]
    expect((await save(original, added)).status).toBe(204)
    expect(await readTags()).toEqual({ [areaCode]: added, [siblingCode]: sibling })

    const edited = [['改写的 "标签"', [23, 12], 2], added[1]]
    expect((await save(added, edited)).status).toBe(204)
    expect(await readTags()).toEqual({ [areaCode]: edited, [siblingCode]: sibling })

    expect((await save(edited, [])).status).toBe(204)
    expect(await readTags()).toEqual({ [areaCode]: [], [siblingCode]: sibling })
  })

  it('拒绝过时、跨域及格式无效的保存', async () => {
    expect((await save([], [])).status).toBe(409)
    expect((await save(original, [], 'http://example.test')).status).toBe(403)
    expect((await save(original, [['无效坐标', ['1', 0]]])).status).toBe(400)
    expect(await readTags()).toEqual({ [areaCode]: original, [siblingCode]: sibling })
  })

  it('同时保存同一地区时只接受一个基于当前配置的写入', async () => {
    const first = [['区域一', [1, 2]]]
    const second = [['区域二', [-1, -2]]]
    const responses = await Promise.all([save(original, first), save(original, second)])
    expect(responses.map(response => response.status).sort()).toEqual([204, 409])
    expect(await readTags()).toEqual({
      [areaCode]: responses[0].status === 204 ? first : second,
      [siblingCode]: sibling,
    })
  })
})
