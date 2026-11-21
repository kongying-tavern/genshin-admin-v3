import type { Ref } from 'vue'
import type { ItemVo, MarkerVo, SysUserVo } from '@/api/alova/globals'
import type { PaginationState } from '@/hooks'
import { useFetchHook } from '@/hooks'
import { useAreaStore, useItemStore, useItemTypeStore, useMarkerStore } from '@/stores'
import { useMapEntitySync } from '@/stores/mapEntitySync'

export interface MarkerSearchParams {
  areaIdList: number[]
  typeIdList: number[]
  itemIdList: number[]
  markerIdList: number[]
}

export interface MarkerSearchHookOptions {
  pagination: Ref<PaginationState>
  getParams: () => MarkerSearchParams
}

/** 根据各种条件筛选查询点位信息 支持根据末端地区、末端类型、物品来进行查询，不填默认分页查询 */
// TODO 接口分页
export const useSearchMarkerList = (options: MarkerSearchHookOptions) => {
  const { pagination, getParams } = options

  const areaStore = useAreaStore()
  const itemStore = useItemStore()
  const markerStore = useMarkerStore()
  const itemTypeStore = useItemTypeStore()
  const sync = useMapEntitySync()
  const markerList = shallowRef<MarkerVo[]>([])

  const lastQueryFlag = shallowRef<string>('')
  const lastQueryCache = shallowRef<MarkerVo[]>([])

  const {
    refresh: updateMarkerList,
    onSuccess,
    ...rest
  } = useFetchHook({
    immediate: true,
    initialValue: {
      markers: [],
      total: 0,
      scope: '',
    },
    onRequest: async () => {
      const { areaIdList, typeIdList, itemIdList, markerIdList } = getParams()
      const { current, pageSize: size } = pagination.value

      const { itemIdMap } = itemStore
      const { markerList } = markerStore

      const dirtyFlag = JSON.stringify([
        sync.scope,
        markerStore.revision,
        itemStore.revision,
        areaIdList,
        typeIdList,
        itemIdList,
        markerIdList,
      ])

      const areaIds = new Set<number>(areaIdList)
      const typeIds = new Set(typeIdList)
      const itemIds = new Set(itemIdList)
      const markerIds = new Set(markerIdList)

      const result =
        dirtyFlag === lastQueryFlag.value
          ? lastQueryCache.value
          : markerList.filter(({ id: markerId, itemList = [] }) => {
              const items = itemList.reduce((seed, { itemId = -1 }) => {
                const item = itemIdMap.get(itemId) ?? { id: itemId }
                seed.push(item)
                return seed
              }, [] as ItemVo[])

              // 1. 筛选包含地区
              if (areaIds.size > 0) {
                for (const { areaId } of items) {
                  if (areaId === undefined || !areaIds.has(areaId!)) return false
                }
              }

              // 2. 筛选物品类型
              if (typeIds.size > 0) {
                const itemTypeIds = items.reduce((set, { typeIdList = [] }) => {
                  typeIdList.forEach(id => set.add(id!))
                  return set
                }, new Set<number>())
                if (itemTypeIds.isDisjointFrom(typeIds)) return false
              }

              // 3. 筛选物品
              if (itemIds.size > 0) {
                for (const { id } of items) {
                  if (!itemIds.has(id!)) return false
                }
              }

              // 4. 筛选 id
              if (markerIds.size > 0) {
                if (!markerIds.has(markerId!)) return false
              }

              return true
            })

      lastQueryFlag.value = dirtyFlag
      lastQueryCache.value = result

      const offset = (current - 1) * size
      const total = result.length
      const markers = result.slice(offset, offset + size)

      return { markers, total, scope: sync.scope }
    },
  })

  const cacheUserInfo = ref(new Map<number, SysUserVo>())

  const cachedUserIds = ref(new Set<number>())

  const fetchUserInfo = async (markers: MarkerVo[]) => {
    const userIds = new Set(markers.map(({ creatorId }) => creatorId!)).difference(
      cachedUserIds.value,
    )

    await Promise.allSettled(
      [...userIds].map(async userId => {
        const { data = {} } = await Apis.user
          .getUserInfo({ pathParams: { userId } })
          .catch(() => ({ data: {} }))
        cachedUserIds.value.add(userId)
        cacheUserInfo.value.set(userId, data)
      }),
    )
  }

  watchDebounced(
    () => [
      markerStore.revision,
      areaStore.areaList,
      itemStore.revision,
      itemTypeStore.itemTypeList,
    ],
    updateMarkerList,
    {
      debounce: 300,
    },
  )

  watch(
    () => sync.scope,
    () => {
      markerList.value = []
      pagination.value.total = 0
      lastQueryFlag.value = ''
      lastQueryCache.value = []
      void updateMarkerList()
    },
    { flush: 'sync' },
  )

  onSuccess(({ markers, total, scope }) => {
    if (scope !== sync.scope) return
    markerList.value = markers
    pagination.value.total = total
    fetchUserInfo(markers)
  })

  return {
    markerList,
    cacheUserInfo,
    updateMarkerList,
    onSuccess,
    ...rest,
  }
}
