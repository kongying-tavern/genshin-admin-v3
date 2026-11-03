import type { ItemTypeVo, RPageListVoItemTypeVo } from '@/api/alova/globals'
import type { FetchHookOptions } from '@/hooks'
import { useSubscription } from '@vueuse/rxjs'
import { liveQuery } from 'dexie'
import db from '@/database'
import { useFetchHook } from '@/hooks'
import { array2Tree } from '@/utils'

/** 物品类型列表与相关操作方法 */
export const useTypeList = (options: FetchHookOptions<RPageListVoItemTypeVo> = {}) => {
  const { immediate, loading: scopedLoading } = options

  /** 物品类型列表 */
  const typeList = ref<ItemTypeVo[]>([])
  /** 物品类型列表加载态 */
  const loading = ref(false)
  /** 物品类型树 */
  const typeTree = computed(() =>
    array2Tree(typeList.value, {
      childrenKey: 'children',
      getId: type => type.id!,
      getPid: type => type.parentId!,
      rootId: -1,
    }),
  )
  /** 物品 id → 物品对象映射表 */
  const typeMap = computed(() =>
    typeList.value.reduce(
      (seed, typeObj) => {
        typeObj.id !== undefined && (seed[typeObj.id] = typeObj)
        return seed
      },
      {} as Record<number, ItemTypeVo>,
    ),
  )

  const {
    refresh: updateTypeList,
    onSuccess,
    ...rest
  } = useFetchHook({
    immediate,
    loading: scopedLoading ?? loading,
    onRequest: () => db.itemType.toArray(),
  })

  useSubscription(liveQuery(() => db.itemType.toCollection()).subscribe(updateTypeList))

  onSuccess(data => {
    typeList.value = data.sort(({ sortIndex: ia }, { sortIndex: ib }) => {
      if (ia === undefined || ib === undefined) return 0
      return ib - ia
    })
  })

  return { typeList, typeTree, typeMap, updateTypeList, onSuccess, ...rest }
}
