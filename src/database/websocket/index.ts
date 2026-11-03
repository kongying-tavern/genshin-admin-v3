import type { WS } from '@/worker/webSocket/types'
import { Dexie } from 'dexie'

export class WebsocketDatabase extends Dexie {
  declare logs: Dexie.Table<WS.Log, number>

  readonly VERSION = 1.1

  readonly STORES = {
    logs: '++id',
  }

  constructor() {
    super('websocket')
    this.version(this.VERSION).stores(this.STORES)
  }
}
