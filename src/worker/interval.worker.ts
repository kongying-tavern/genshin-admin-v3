export {}

declare const globalThis: DedicatedWorkerGlobalScope

export interface IntervalPayload {
  name: string
  interval?: number
  action: 'set' | 'clear'
}

const missionMap: Record<string, number> = {}

globalThis.addEventListener('message', ({ data }: MessageEvent<IntervalPayload>) => {
  const { name, interval = 1000, action } = data

  if (action === 'set') {
    missionMap[name] = globalThis.setInterval(() => {
      globalThis.postMessage(name)
    }, interval)
  } else if (action === 'clear') {
    globalThis.clearInterval(missionMap[name])
    delete missionMap[name]
  }
})
