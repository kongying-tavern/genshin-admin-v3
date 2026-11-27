import type { RequestMessage } from '@/utils/worker/types'
import type { StaticResource } from './static-resource-policy'

export type StaticResourceOperation =
  | 'hit'
  | 'stored'
  | 'stale'
  | 'network'
  | 'open-error'
  | 'match-error'
  | 'delete-error'
  | 'put-error'
  | 'fetch-error'

const ERROR_NAMES = new Set([
  'AbortError',
  'Error',
  'InvalidStateError',
  'NetworkError',
  'NotFoundError',
  'QuotaExceededError',
  'SecurityError',
  'TimeoutError',
  'TypeError',
])

const errorName = (error: unknown) => {
  const name = error instanceof Error || error instanceof DOMException ? error.name : 'Error'
  return ERROR_NAMES.has(name) ? name : 'Error'
}

export const logStaticResource = async (
  clients: Pick<Clients, 'get'>,
  clientId: string,
  resource: StaticResource,
  operation: StaticResourceOperation,
  detail?: unknown,
) => {
  if (!clientId) return
  try {
    const client = await clients.get(clientId)
    if (client?.type !== 'window') return

    const isError = operation.endsWith('-error')
    const status =
      typeof detail === 'number' && Number.isInteger(detail) && detail >= 0 && detail <= 599
        ? ` ${detail}`
        : ''
    const suffix = isError ? ` ${errorName(detail)}` : status
    client.postMessage({
      id: crypto.randomUUID(),
      type: 'request',
      channel: 'log',
      args: [isError ? 'error' : 'info', `${resource} ${operation}${suffix}`],
    } satisfies RequestMessage<AppServiceWorker.EventMap['log']['args']>)
  } catch {
    // 请求来源可能已经关闭，诊断投递失败不影响响应。
  }
}
