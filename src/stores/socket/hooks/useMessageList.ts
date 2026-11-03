import type { EventBus } from '@/utils'
import { useSubscription } from '@vueuse/rxjs'
import { liveQuery } from 'dexie'
import db from '@/database'

export const useMessageList = (messageEvent: EventBus<Socket.DataEventMap>) => {
  const _messageList = shallowRef<Socket.DataEventRecord[]>([])

  const clearMessageList = () => {
    _messageList.value = []
  }

  useSubscription(
    liveQuery(() => {
      return db.websocketEvents.orderBy('time').reverse().limit(100).reverse().toArray()
    }).subscribe(list => {
      _messageList.value = list
    }),
  )

  messageEvent.on('MarkerAdded', async (markerInfo, user) => {
    const data: Socket.DataEventRecord<'MarkerAdded'> = {
      key: crypto.randomUUID(),
      type: 'MarkerAdded',
      args: [markerInfo, user],
      time: new Date(markerInfo.createTime ?? 0).getTime(),
      user,
    }
    await db.websocketEvents.add(JSON.parse(JSON.stringify(data)))
  })

  messageEvent.on('MarkerUpdated', async (markerInfo, user) => {
    const data: Socket.DataEventRecord<'MarkerUpdated'> = {
      key: crypto.randomUUID(),
      type: 'MarkerUpdated',
      args: [markerInfo, user],
      time: new Date(markerInfo.updateTime ?? 0).getTime(),
      user,
    }
    await db.websocketEvents.add(JSON.parse(JSON.stringify(data)))
  })

  messageEvent.on('MarkerDeleted', async (markerInfo, user) => {
    const data: Socket.DataEventRecord<'MarkerDeleted'> = {
      key: crypto.randomUUID(),
      type: 'MarkerDeleted',
      args: [markerInfo, user],
      time: new Date(markerInfo.updateTime ?? 0).getTime(),
      user,
    }
    await db.websocketEvents.add(JSON.parse(JSON.stringify(data)))
  })

  messageEvent.on('MarkerTweaked', async (markers, user) => {
    const [first] = markers
    if (!first) return
    const data: Socket.DataEventRecord<'MarkerTweaked'> = {
      key: crypto.randomUUID(),
      type: 'MarkerTweaked',
      args: [markers, user],
      time: new Date(first.updateTime ?? 0).getTime(),
      user,
    }
    await db.websocketEvents.add(JSON.parse(JSON.stringify(data)))
  })

  messageEvent.on('MarkerLinked', async (markers, user) => {
    const [first] = markers
    if (!first) return
    const data: Socket.DataEventRecord<'MarkerLinked'> = {
      key: crypto.randomUUID(),
      type: 'MarkerLinked',
      args: [markers, user],
      time: new Date(first.updateTime ?? 0).getTime(),
      user,
    }
    await db.websocketEvents.add(JSON.parse(JSON.stringify(data)))
  })

  return {
    messageList: _messageList as Readonly<Ref<Socket.DataEventRecord[]>>,
    clearMessageList,
  }
}
