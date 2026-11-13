import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getSystemConfig } from '@/api/config'
import {
  isBz2Archive,
  probeSystemConfigArchive,
  systemConfigArchiveUrl,
  systemConfigJsonUrl,
} from '../_support/systemConfig'

/**
 * 集成测试：真实开发环境的系统订阅配置
 *
 * 直接使用 dev 资源服务器上发布的归档（`VITE_CONFIG_ARCHIVE`，默认是 bz2 版本），
 * 验证「下载 → 解压 → JSON 解析」整条链路能还原出后台依赖的配置结构。
 *
 * 解压环节复用应用自身的 `Zip.decompressAs`：
 * worker 被替换为在主线程内直接调用 7z-wasm 的替身（与线上使用同一份 7zz.wasm），
 * 这样无需浏览器多线程环境，又能覆盖 `Zip` 的取 wasm、消息通信与 JSON 解码逻辑。
 */

interface SevenZipFS {
  writeFile: (name: string, data: Uint8Array) => void
  readdir: (dir: string) => string[]
  readFile: (name: string) => Uint8Array
}

interface SevenZip {
  FS: SevenZipFS
  callMain: (args: string[]) => void
}

type SevenZipFactory = (options: {
  wasmBinary: Uint8Array
  print?: (text: string) => void
}) => Promise<SevenZip>

const require = createRequire(import.meta.url)
const SevenZip = require('7z-wasm') as SevenZipFactory

/** jsdom 环境没有 `?url` 资源服务器，直接从 node_modules 读取与线上一致的 wasm */
const wasmBinary = readFileSync(
  path.resolve(import.meta.dirname, '../../../node_modules/7z-wasm/7zz.wasm'),
)

/** 使用 7z-wasm 解压 bz2，等价于 `src/worker/zip.worker.ts` 中的 decompressFile */
const decompressBz2 = async (data: Uint8Array) => {
  const zip = await SevenZip({ wasmBinary, print: () => {} })
  zip.FS.writeFile('in.bz2', data)
  zip.callMain(['x', '-oout', '-y', 'in.bz2'])
  const outputName = zip.FS.readdir('out').find(name => name && !name.startsWith('.')) ?? ''
  return zip.FS.readFile(`out/${outputName}`)
}

vi.mock('@/database', () => ({
  cache: {
    file: {
      // 命中本地缓存，跳过 wasm 的下载
      get: async () => ({ buffer: wasmBinary, name: '7zz.wasm' }),
      put: async () => {},
    },
  },
}))

vi.mock('@/worker/zip.worker?worker', () => {
  class FakeZipWorker {
    postMessage(payload: { type: string; data: Uint8Array }, transfer: Transferable[]) {
      const [mainPort] = transfer as MessagePort[]

      if (payload.type !== 'decompress') {
        mainPort.postMessage('unsupported worker message')
        return
      }

      decompressBz2(payload.data).then(
        data => mainPort.postMessage(data, [data.buffer as ArrayBuffer]),
        (err: unknown) => mainPort.postMessage(err instanceof Error ? err.message : `${err}`),
      )
    }

    terminate() {}
  }

  return { default: FakeZipWorker }
})

const enabled = await probeSystemConfigArchive()

describe.skipIf(!enabled)('集成：系统订阅配置归档', () => {
  let Zip: (typeof import('@/utils/Zip'))['Zip']

  beforeAll(async () => {
    ;({ Zip } = await import('@/utils/Zip'))
  })

  /** 按归档地址后缀选择解压或直接解析 */
  const loadConfig = async () => {
    const buffer = await getSystemConfig()
    if (!isBz2Archive) return JSON.parse(new TextDecoder().decode(buffer)) as DTO.DadianJSON
    return await Zip.decompressAs<DTO.DadianJSON>(new Uint8Array(buffer), {
      name: 'system-config',
    })
  }

  it('归档地址取自 VITE_CONFIG_ARCHIVE', () => {
    expect(systemConfigArchiveUrl).toBeTruthy()
  })

  it('归档非空，且格式与地址后缀一致', async () => {
    const buffer = await getSystemConfig()

    expect(buffer.byteLength).toBeGreaterThan(0)

    if (isBz2Archive) {
      // bzip2 魔数
      expect(new TextDecoder().decode(new Uint8Array(buffer).subarray(0, 3))).toBe('BZh')
    } else {
      expect(() => JSON.parse(new TextDecoder().decode(buffer))).not.toThrow()
    }
  })

  it.skipIf(!isBz2Archive)('bz2 归档可解压并解析为 JSON', async () => {
    const config = await loadConfig()

    expect(config).toBeTypeOf('object')
    expect(config).not.toBeNull()
  })

  it('包含后台依赖的核心配置项', async () => {
    const config = await loadConfig()

    // 底图：地区切换、瓦片地址与视口初始化都依赖 base0
    const baseTile = config.tiles?.['提瓦特-base0']
    expect(baseTile).toBeTypeOf('object')
    expect(baseTile?.code).toBeTypeOf('string')
    expect(baseTile?.name).toBeTypeOf('string')
    expect(baseTile?.size).toHaveLength(2)

    // 插件：叠加层与 marker extra 均从这里取值
    const pluginEntries = Object.entries(config.plugins ?? {})
    expect(pluginEntries.length).toBeGreaterThan(0)
    expect(pluginEntries[0][1]).toBeTypeOf('object')

    // 名片：个人信息卡片的可选项
    expect(Array.isArray(config.application?.nameCard)).toBe(true)
    expect(config.application?.nameCard?.length).toBeGreaterThan(0)
    expect(config.application?.nameCard?.[0]?.label).toBeTypeOf('string')

    // 编辑器配置：字体资源、快捷输入等
    expect(config.editor).toBeTypeOf('object')
  })

  it.skipIf(!isBz2Archive)('明文 JSON 与 bz2 归档内容一致', async () => {
    const config = await loadConfig()

    const res = await fetch(systemConfigJsonUrl, { signal: AbortSignal.timeout(15_000) })
    expect(res.ok).toBe(true)

    const json = (await res.json()) as DTO.DadianJSON
    expect(json).toEqual(config)
  })
})
