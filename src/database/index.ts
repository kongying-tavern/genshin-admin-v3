import { CacheDexie } from './db/cache'
import { MainThreadDB } from './db/main'

const db = new MainThreadDB()
const cache = new CacheDexie()

export { wsdb } from './websocket'
export { cache }

export default db
