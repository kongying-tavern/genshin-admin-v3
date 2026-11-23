import type { DiagnosticRecord } from './types'
import type { WS } from '@/worker/webSocket/types'
import { Dexie } from 'dexie'

export class WebsocketDatabase extends Dexie {
  declare logs: Dexie.Table<WS.Log, number>
  declare diagnostics: Dexie.Table<DiagnosticRecord, string>

  constructor() {
    super('websocket')
    this.version(1.1).stores({ logs: '++id' })
    this.version(1.2).stores({
      diagnostics:
        '&id, [accountId+startedAt], [accountId+issueAt], [accountId+kind+startedAt], [accountId+completed+exceptional+startedAt]',
    })
  }
}

export const wsdb = new WebsocketDatabase()
