import type { ItemVo, MarkerExtraVo, MarkerVo } from '@/api/alova/globals'

/**
 * 为点位选择主要渲染图标
 * @todo 可能需要根据设置来选择策略
 */
export const pickMainItem = ({ itemList, extra }: MarkerVo, itemIdMap: Map<number, ItemVo>) => {
  const restItemIds: number[] = []
  const restIconTags: string[] = []

  let index = -1
  let mainItem: ItemVo | undefined

  itemList?.forEach(({ itemId = -1 }) => {
    const item = itemIdMap.get(itemId)
    if (!item) return

    if (!mainItem) {
      mainItem = item
      index = item.sortIndex ?? -1
      return
    }

    // 将 sortIndex 更大的作为主渲染图标
    const { sortIndex = -1 } = item
    if (sortIndex <= index) return

    mainItem = item
    index = sortIndex
  })

  const { iconOverride } = (extra ?? {}) as MarkerExtraVo

  return {
    mainItemId: mainItem?.id ?? -1,
    restItemIds,
    mainIconId: iconOverride?.id ?? mainItem?.iconId ?? -1,
    restIconTags,
  }
}
