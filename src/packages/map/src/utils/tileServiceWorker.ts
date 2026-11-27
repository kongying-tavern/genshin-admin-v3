import { TILE_BYPASS_ACK, TILE_BYPASS_PROBE } from './tileServiceWorkerProtocol'

export const createTileCacheGate = (serviceWorker?: ServiceWorkerContainer) => {
  let controller: ServiceWorker | null = null
  let confirmed = false
  let epoch = 0

  const refreshController = () => {
    const next = serviceWorker?.controller ?? null
    if (next === controller) return
    controller = next
    confirmed = false
    epoch += 1
    try {
      controller?.postMessage(TILE_BYPASS_PROBE)
    } catch {
      // 控制器可能已终止，等待控制器切换，瓦片继续走 fetch。
    }
  }

  serviceWorker?.addEventListener('controllerchange', refreshController)
  serviceWorker?.addEventListener('message', ({ data, source }) => {
    if (data !== TILE_BYPASS_ACK) return
    refreshController()
    if (controller && source === controller) confirmed = true
  })

  return {
    allowed: () => {
      refreshController()
      return !controller || confirmed
    },
    epoch: () => {
      refreshController()
      return epoch
    },
  }
}

let gate: ReturnType<typeof createTileCacheGate> | undefined

const getGate = () => (gate ??= createTileCacheGate(globalThis.navigator?.serviceWorker))

export const tileCacheAllowed = (): boolean => getGate().allowed()

export const tileCacheEpoch = (): number => getGate().epoch()
