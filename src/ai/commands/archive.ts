import type { BridgeCommand } from '@/ai/types'
import type { ArchiveData } from '@/stores/archive'
import { toValue } from 'vue'
import { fail } from '@/ai/errors'
import { objectSchema } from '@/ai/validate'
import { useArchiveStore } from '@/stores/archive'
import { useMarkerStore } from '@/stores/marker'
import { useUserStore } from '@/stores/user'

const assertLoggedIn = () => {
  if (!useUserStore().info) fail('E_FORBIDDEN', '请先登录后再修改点位完成状态')
}

const readArchive = () => toValue(useArchiveStore().currentArchive) as ArchiveData

const setMarked = async (id: number, marked: boolean) => {
  assertLoggedIn()
  const markerStore = useMarkerStore()
  if (!markerStore.idMap.has(id)) {
    fail('E_NOT_FOUND', `点位不存在：${id}`)
  }
  const archiveStore = useArchiveStore()
  const archive = readArchive()
  const nextSet = new Set(archive.body.Data_KYJG)
  if (marked) nextSet.add(id)
  else nextSet.delete(id)
  archive.body.Data_KYJG = nextSet
  await archiveStore.flush()
  return {
    id,
    marked,
    markedCount: nextSet.size,
  }
}

/** archive.* 命令 */
export const createArchiveCommands = (): BridgeCommand[] => [
  {
    id: 'archive.state',
    title: '存档状态',
    description: '读取当前存档槽位、已完成点位数与存档时间戳',
    access: 'read',
    params: objectSchema({}),
    returns: '{ slotIndex, markedCount, timestamp }',
    handler: () => {
      const archive = readArchive()
      return {
        slotIndex: archive.slotIndex,
        markedCount: archive.body.Data_KYJG.size,
        timestamp: archive.timestamp,
      }
    },
  },
  {
    id: 'archive.mark',
    title: '标记点位完成',
    description: '将点位加入当前存档的已完成集合，并立即触发存档同步',
    access: 'write',
    params: objectSchema({ id: { type: 'number', description: '点位 id' } }, ['id']),
    returns: '{ id, marked, markedCount }',
    handler: params => setMarked(params.id as number, true),
  },
  {
    id: 'archive.unmark',
    title: '取消点位完成',
    description: '将点位从当前存档的已完成集合移除，并立即触发存档同步',
    access: 'write',
    params: objectSchema({ id: { type: 'number', description: '点位 id' } }, ['id']),
    returns: '{ id, marked, markedCount }',
    handler: params => setMarked(params.id as number, false),
  },
  {
    id: 'archive.flush',
    title: '立即同步存档',
    description: '跳过自动去抖，立即将当前存档写入本地与远程槽位',
    access: 'write',
    params: objectSchema({}),
    returns: '{ synced }',
    handler: async () => {
      await useArchiveStore().flush()
      return { synced: true }
    },
  },
]
