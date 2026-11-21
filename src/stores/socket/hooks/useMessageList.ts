import type { EventBus } from '@/utils'
import { Dexie, liveQuery } from 'dexie'
import db from '@/database'
import { Logger } from '@/utils/logger'

const logger = new Logger('Socket 消息')

export const useMessageList = (events: EventBus<Socket.DataEventMap>, getScope: () => string) => {
  const messageList = shallowRef<Socket.DataEventRecord[]>([])
  const records = (scope: string) =>
    db.websocketEvents.where('[scope+time]').between([scope, Dexie.minKey], [scope, Dexie.maxKey])

  watch(
    getScope,
    (scope, _, onCleanup) => {
      messageList.value = []
      if (!scope) return
      const subscription = liveQuery(() => records(scope).reverse().limit(100).toArray()).subscribe(
        {
          next: list => {
            if (getScope() === scope) messageList.value = list.reverse()
          },
          error: cause => logger.error(cause),
        },
      )
      onCleanup(() => subscription.unsubscribe())
    },
    { immediate: true, flush: 'sync' },
  )

  const clearMessageList = async () => {
    const scope = getScope()
    if (scope) await records(scope).delete()
  }

  const save = <K extends keyof Socket.DataEventMap>(
    type: K,
    args: Socket.DataEventMap[K],
    user: Socket.DataEventRecord['user'],
    timestamp: string | undefined,
  ) => {
    const scope = getScope()
    if (!scope) return
    const time = timestamp ? new Date(timestamp).getTime() : Date.now()
    const record: Socket.DataEventRecord<K> = {
      key: crypto.randomUUID(),
      scope,
      type,
      args,
      user,
      time: Number.isFinite(time) ? time : Date.now(),
    }
    void db.websocketEvents
      .add(JSON.parse(JSON.stringify(record)))
      .catch(cause => logger.error(cause))
  }

  events.on('MarkerAdded', (info, user) => save('MarkerAdded', [info, user], user, info.createTime))
  events.on('MarkerUpdated', (info, user) =>
    save('MarkerUpdated', [info, user], user, info.updateTime),
  )
  events.on('MarkerDeleted', (info, user) =>
    save('MarkerDeleted', [info, user], user, info.updateTime),
  )
  events.on('MarkerTweaked', (list, user) => {
    if (list.length) save('MarkerTweaked', [list, user], user, list[0].updateTime)
  })
  events.on('MarkerLinked', (list, user) => {
    if (list.length) save('MarkerLinked', [list, user], user, list[0].updateTime)
  })

  return { messageList, clearMessageList }
}
