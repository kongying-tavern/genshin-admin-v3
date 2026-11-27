import { createTileCacheGate } from '@/packages/map/src/utils/tileServiceWorker'
import {
  TILE_BYPASS_ACK,
  TILE_BYPASS_PROBE,
} from '@/packages/map/src/utils/tileServiceWorkerProtocol'
import {
  isTileUrl,
  normalizeTileBase,
  parseTileUrl,
  tileUrl,
} from '@/packages/map/src/utils/tileUrl'
import { describe, expect, it, vi } from 'vitest'

describe('瓦片 URL', () => {
  it('规范化图源的路径，保留坐标和自定义扩展名', () => {
    const base = normalizeTileBase('https://OSS.assets.example:443/world///?x=1#top')
    expect(base).toBe('https://oss.assets.example/world')
    const url = tileUrl(base, 'twt40', 10, -1, 2, 'webp')
    expect(url).toBe('https://oss.assets.example/world/tiles_twt40/10/-1_2.webp')
    expect(parseTileUrl(url)).toEqual({ base, code: 'twt40' })
    expect(isTileUrl(url, 'https://oss.assets.example/other')).toBe(false)
    expect(isTileUrl(url, 'https://other.assets.example/world')).toBe(false)
    expect(isTileUrl(`${base}/tiles_twt40/10/-1_2.webp/extra`, base)).toBe(false)
  })

  it('可解析相对基址和旧 URL 的多余斜杠', () => {
    const base = normalizeTileBase('/world/', 'https://assets.example/app')
    expect(parseTileUrl(`${base}//tiles_twt40/13/-1_-2.png`)).toEqual({ base, code: 'twt40' })
  })
})

const createController = () => ({ postMessage: vi.fn() })

const createContainer = () => {
  const container = Object.assign(new EventTarget(), {
    controller: null as ReturnType<typeof createController> | null,
  })
  const gate = createTileCacheGate(container as unknown as ServiceWorkerContainer)
  const change = () => container.dispatchEvent(new Event('controllerchange'))
  const confirm = (source: ReturnType<typeof createController>) =>
    container.dispatchEvent(Object.assign(new Event('message'), { data: TILE_BYPASS_ACK, source }))
  return { container, gate, change, confirm }
}

describe('瓦片缓存的控制器确认', () => {
  it('在无控制器时启用缓存，遇到旧控制器时继续在线读取', () => {
    const { container, gate, change } = createContainer()
    expect(gate.allowed()).toBe(true)
    const initialEpoch = gate.epoch()

    const legacy = createController()
    container.controller = legacy
    change()
    expect(gate.epoch()).toBe(initialEpoch + 1)
    expect(gate.allowed()).toBe(false)
    expect(gate.allowed()).toBe(false)
    expect(legacy.postMessage).toHaveBeenCalledExactlyOnceWith(TILE_BYPASS_PROBE)

    container.controller = null
    change()
    expect(gate.epoch()).toBe(initialEpoch + 2)
    expect(gate.allowed()).toBe(true)
  })

  it('接受当前控制器的确认并丢弃切换期间的旧确认', () => {
    const { container, gate, change, confirm } = createContainer()
    const first = createController()
    container.controller = first
    expect(gate.allowed()).toBe(false)
    confirm(first)
    expect(gate.allowed()).toBe(true)

    const next = createController()
    container.controller = next
    change()
    expect(next.postMessage).toHaveBeenCalledExactlyOnceWith(TILE_BYPASS_PROBE)
    confirm(first)
    expect(gate.allowed()).toBe(false)
    confirm(next)
    expect(gate.allowed()).toBe(true)
  })
})
