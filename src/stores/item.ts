import type { ItemVo } from '@/api/alova/globals'
import type { DetailReadObserver } from './mapEntitySync/model'
import { Box } from '@element-plus/icons-vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import Apis from '@/api/alova'
import { useAccessStore } from './access'
import { useMapEntitySync } from './mapEntitySync'
import { stageArchive } from './mapEntitySync/archives'
import { isEntityId } from './mapEntitySync/model'
import { checkDetails, fetchItemAreas } from './mapEntitySync/sources'
import { useEntityManager } from './mapEntitySync/useEntityManager'
import { useSocketStore } from './socket'

export const useItemStore = defineStore('global-item', () => {
  const access = useAccessStore()
  const socket = useSocketStore()
  const sync = useMapEntitySync()
  type Session = ReturnType<typeof sync.current>

  const empty = new Map<number, ItemVo>()
  const idMap = computed(() =>
    sync.projection.state.resources.item?.baseline ? sync.projection.entities.item : empty,
  )
  const itemList = computed(() =>
    [...idMap.value.values()]
      .filter(row => access.checkHiddenFlag(row.hiddenFlag))
      .sort((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0)),
  )
  const total = computed(() => itemList.value.length)
  const revision = computed(() => sync.projection.revisions.item)

  const manager = useEntityManager(sync, 'item', async (session, full, task) => {
    const { state, entities, pending } = await sync.refresh(session)
    const resource = state.resources.item
    if (!full) {
      const staged = await task
        .trackDownload('正在下载归档分片', { to: 0.8 }, onDownloadProgress =>
          stageArchive(sync, session, 'item', resource, { onDownloadProgress }),
        )
        .catch(() => undefined)
      if (staged?.entities)
        return {
          input: {
            revision: state.revision,
            batches: {
              item: {
                archive: true,
                updates: staged.entities,
                deletes: staged.removed,
                state: { ...staged.state, baseline: true },
              },
            },
          },
        }
      if (
        staged?.unchanged
        && resource?.baseline
        && !resource.pendingRanges?.length
        && !pending.item.size
      )
        return { input: { batches: {} } }
    }
    const { items, failed } = await fetchItemAreas(task)
    const incomplete = failed.size ? `${failed.size} 个地区的物品尚待核对` : undefined
    // 任一区域失败就保留缺失记录。物品可能已跨区移动到查询失败的地区。
    const deletes = incomplete
      ? []
      : [...new Set([...entities.item.keys(), ...pending.item])].filter(id => !items.has(id))
    return {
      input: {
        revision: state.revision,
        batches: {
          item: {
            updates: [...items.values()],
            deletes,
            state: {
              ...(incomplete ? {} : { baseline: true, checkedAt: Date.now() }),
              pendingRanges: [...failed].map(String),
            },
          },
        },
      },
      incomplete,
    }
  })

  async function readItems(session: Session, ids: number[], observer?: DetailReadObserver) {
    const { state, entities } = await sync.refresh(session)
    observer?.start()
    const { data, users = {} } = await Apis.item.listItemById({ data: ids })
    if (!Array.isArray(data)) throw new Error('物品详情响应异常')
    const missing = checkDetails(data, ids)
    observer?.received(missing)
    const moved = data.some(item => {
      const oldArea = entities.item.get(item.id!)?.areaId
      return oldArea !== undefined && oldArea !== item.areaId
    })
    const { conflict } = await sync.commit(session, {
      revision: state.revision,
      batches: { item: { updates: data } },
    })
    sync.assertCurrent(session)
    if (conflict || missing.length) throw new Error('物品详情尚待核对')
    if (moved) void manager.update()
    return {
      items: ids.flatMap(id => {
        const item = sync.projection.entities.item.get(id)
        return item ? [item] : []
      }),
      users,
    }
  }

  const readAfterMutation = (session: Session, ids: number[]) => {
    if (!ids.length) return
    void sync
      .invalidate(session, 'item', ids)
      .then(() => sync.enqueue(session, () => readItems(session, ids)))
      .catch(cause => {
        sync.reportError(session, cause)
        if (sync.isCurrent(session)) void manager.update()
      })
  }

  const createItem = async (form: ItemVo) => {
    const session = sync.current()
    const { data: id } = await Apis.item.createItem({ data: form })
    if (!isEntityId(id)) throw new Error('服务器未返回新物品 ID')
    readAfterMutation(session, [id])
  }

  const updateItem = async (form: ItemVo) => {
    if (!isEntityId(form.id)) throw new Error('物品 ID 无效')
    const session = sync.current()
    const { data: ids = [] } = await Apis.item.updateItem({
      pathParams: { editSame: 0 },
      data: [form],
    })
    readAfterMutation(session, [...new Set([form.id, ...ids])])
  }

  const deleteItem = async (id: number) => {
    const session = sync.current()
    const { data, message } = await Apis.item.deleteItem({ pathParams: { itemId: id } })
    if (!data) throw new Error(message)
    await sync.remove(session, 'item', [id])
  }

  for (const [event, action, color] of [
    ['ItemAdded', '添加', 'success'],
    ['ItemUpdated', '更新', 'primary'],
    ['ItemDeleted', '删除', 'danger'],
  ] as const) {
    socket.appEvent.on(event, (item, { username, nickname }) => {
      socket.notice(event, {
        message: `${nickname ?? username ?? '其他用户'} ${action}了物品 ${item.name ?? ''} (id:${item.id})`,
        icon: Box,
        customClass: `text-[var(--el-color-${color})]`,
      })
    })
  }

  return {
    ...manager,
    idMap,
    itemIdMap: idMap,
    itemList,
    revision,
    total,
    readItems,
    createItem,
    updateItem,
    deleteItem,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useItemStore, import.meta.hot))
}
