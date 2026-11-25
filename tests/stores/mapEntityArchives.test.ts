import type { BinaryDownloadListener } from '@/api/alova/binaryDownload'
import type { ArchivePage, ResourceState } from '@/stores/mapEntitySync/model'
import { Blob } from 'node:buffer'
import { gzipSync } from 'node:zlib'
import { md5 } from 'js-md5'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const environment = vi.hoisted(() => ({
  pages: new Map<string, ArchivePage>(),
  bodies: new Map<string, ArrayBuffer>(),
  manifest: [] as string[],
  requests: [] as string[],
  unknownLength: new Set<string>(),
}))

vi.mock('@/api/alova', () => ({
  default: {
    item_doc: {
      listItemBinaryMD5: async () => ({
        data: environment.manifest.map(md5 => ({ md5, time: 1_700_000_000 })),
      }),
      listPageItemByBinary: async ({
        pathParams: { md5 },
        meta: { onBinaryDownload },
      }: {
        pathParams: { md5: string }
        meta: { onBinaryDownload?: BinaryDownloadListener }
      }) => {
        environment.requests.push(md5)
        const body = environment.bodies.get(md5)
        if (!body) throw new Error('下载中断')
        onBinaryDownload?.(
          Math.floor(body.byteLength / 2),
          environment.unknownLength.has(md5) ? undefined : body.byteLength,
        )
        return body
      },
    },
  },
}))
vi.mock('@/database', () => ({
  default: {
    mapArchivePage: {
      bulkGet: async (keys: [string, string, number, string][]) =>
        keys.map(key => environment.pages.get(key.join('/'))),
      put: async (page: ArchivePage) => {
        environment.pages.set([page.scope, page.resource, page.format, page.digest].join('/'), page)
      },
    },
  },
}))
vi.mock('@/utils/Zip', () => ({ Zip: {} }))

const sync = { assertCurrent: () => undefined }
const session = { scope: 'scope', tail: Promise.resolve() }
const page = (...ids: number[]) => {
  const bytes = Uint8Array.from(
    gzipSync(
      JSON.stringify(
        ids.map(id => ({
          id,
          version: 1,
          areaId: 2,
          typeIdList: [3],
        })),
      ),
    ),
  ).buffer
  const digest = md5(bytes)
  return { digest, bytes }
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_MAP_ENTITY_ARCHIVES', 'item')
  vi.stubGlobal('Blob', Blob)
  environment.pages.clear()
  environment.bodies.clear()
  environment.requests.length = 0
  environment.unknownLength.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('地图实体归档', () => {
  it('汇总并行分片的下载进度和已接收字节，跳过缓存分片', async () => {
    const { stageArchive } = await import('@/stores/mapEntitySync/archives')
    const cached = page(1)
    const known = page(2)
    const unknown = page(3)
    environment.bodies.set(cached.digest, cached.bytes)
    environment.manifest = [cached.digest]
    await stageArchive(sync, session, 'item', undefined)

    environment.requests.length = 0
    environment.manifest.push(known.digest, unknown.digest)
    environment.bodies.set(known.digest, known.bytes)
    environment.bodies.set(unknown.digest, unknown.bytes)
    environment.unknownLength.add(unknown.digest)
    const onDownloadProgress = vi.fn<(ratio: number, bytes: number) => void>()
    await stageArchive(sync, session, 'item', undefined, { onDownloadProgress })

    expect(environment.requests).toEqual([known.digest, unknown.digest].sort())
    expect(onDownloadProgress).toHaveBeenNthCalledWith(1, 0, 0)
    const knownPartial = Math.floor(known.bytes.byteLength / 2)
    const unknownPartial = Math.floor(unknown.bytes.byteLength / 2)
    const [ratio, bytes] = onDownloadProgress.mock.calls[2]
    expect(ratio).toBeCloseTo(knownPartial / known.bytes.byteLength / 2)
    expect(bytes).toBe(knownPartial + unknownPartial)
    expect(onDownloadProgress).toHaveBeenLastCalledWith(
      1,
      known.bytes.byteLength + unknown.bytes.byteLength,
    )
  })

  it('下载中断后复用已验证的页，并在热库清单相同时跳过正文', async () => {
    const { stageArchive } = await import('@/stores/mapEntitySync/archives')
    const first = page(1)
    const second = page(2)
    environment.manifest = [first.digest, second.digest]
    environment.bodies.set(first.digest, first.bytes)
    await expect(stageArchive(sync, session, 'item', undefined)).rejects.toThrow('下载中断')
    expect(environment.pages.size).toBe(1)
    environment.bodies.set(second.digest, second.bytes)
    environment.requests.length = 0
    const result = await stageArchive(sync, session, 'item', undefined)
    expect(result?.entities).toHaveLength(2)
    expect(environment.requests).toEqual([second.digest])
    const active = { baseline: true, checkedAt: 0, ...result?.state } as ResourceState
    environment.requests.length = 0
    const onDownloadProgress = vi.fn()
    const unchanged = await stageArchive(sync, session, 'item', active, { onDownloadProgress })
    expect(unchanged?.unchanged).toBe(true)
    expect(environment.requests).toEqual([])
    expect(onDownloadProgress).not.toHaveBeenCalled()
  })

  it('用整个清单计算成员删除，实体移页仍然保留', async () => {
    const { stageArchive } = await import('@/stores/mapEntitySync/archives')
    const previous = [page(1, 2), page(3)]
    environment.manifest = previous.map(({ digest }) => digest)
    for (const { digest, bytes } of previous) environment.bodies.set(digest, bytes)
    const active = await stageArchive(sync, session, 'item', undefined)
    const moved = page(1, 3)
    const fresh = page(4)
    for (const { digest, bytes } of [moved, fresh]) environment.bodies.set(digest, bytes)
    environment.manifest = [fresh.digest, moved.digest]
    const result = await stageArchive(sync, session, 'item', {
      baseline: true,
      checkedAt: 0,
      ...active?.state,
    })
    expect(result?.removed).toEqual([2])
    expect(result?.entities?.map(({ id }) => id).sort()).toEqual([1, 3, 4])
  })

  it('拒绝摘要不匹配的正文', async () => {
    const { decodeArchive } = await import('@/stores/mapEntitySync/archives')
    await expect(decodeArchive('item', page(1).bytes, page(2).digest)).rejects.toThrow('摘要')
  })
})
