import type { RequestMessage, ResponseMessage } from './types'

export const isResponse = (v: unknown): v is ResponseMessage => {
  if (typeof v !== 'object') return false
  if (v === null) return false
  return 'type' in v && v.type === 'response'
}

export const isRequest = (v: unknown): v is RequestMessage => {
  if (typeof v !== 'object') return false
  if (v === null) return false
  return 'type' in v && v.type !== 'response'
}

export const isSharedWorker = (v: WorkerGlobalScope): v is SharedWorkerGlobalScope => {
  return 'SharedWorkerGlobalScope' in v
}

export const isServiceWorker = (v: WorkerGlobalScope): v is ServiceWorkerGlobalScope => {
  return 'ServiceWorkerGlobalScope' in v
}
