import type { FormRules } from 'element-plus'
import type { MarkerItemLinkVo } from '@/api/alova/globals'
import { useAreaStore, useItemStore, useItemTypeStore } from '@/stores'
import { requireCheck } from '@/utils'

export const useRules = () => {
  const areaStore = useAreaStore()
  const itemStore = useItemStore()
  const itemTypeStore = useItemTypeStore()

  /** 表示为宝箱品质的物品类型 */
  const typeQuality = computed(() =>
    itemTypeStore.itemTypeList.find(type => type.name === '宝箱品质'),
  )

  /** 表示为获取方式的物品类型 */
  const typeWay = computed(() => itemTypeStore.itemTypeList.find(type => type.name === '获取方式'))

  const rules: FormRules = {
    areaCode: [requireCheck('change', '所属地区')],

    markerTitle: [requireCheck('change', '标题')],

    hiddenFlag: [requireCheck('change', '点位标识')],

    itemList: [
      {
        validator: (_, itemList: MarkerItemLinkVo[], callback) => {
          try {
            if (itemList?.length < 1) throw new Error('至少需要选择一项物品')

            const items =
              itemList?.map(({ itemId, count = 0 }) => {
                if (Number.isNaN(count) || count < 0)
                  throw new Error('物品数量必须是一个合法的数字')
                return itemStore.itemIdMap.get(itemId!)!
              }) ?? []

            const itemsGroupByAreaId = Map.groupBy(items, item => item.areaId!)

            const qualityTypeId = toValue(typeQuality)?.id
            if (qualityTypeId === undefined) throw new Error('无法获取"宝箱品质"的类型 id')

            const wayTypeId = toValue(typeWay)?.id
            if (wayTypeId === undefined) throw new Error('无法获取"获取方式"的类型 id')

            // 逐地区校验
            itemsGroupByAreaId.forEach((items, areaId) => {
              /** 宝箱品质 */
              let maskQuality = 0
              /** 获取方式 */
              let maskWay = 0

              const { name: areaName = `(id:${areaId})` } = areaStore.areaIdMap.get(areaId) ?? {}

              items.forEach(({ typeIdList }) => {
                const typeIds = new Set(typeIdList)
                if (typeIds.has(qualityTypeId)) {
                  if (maskQuality > 0) throw new Error('每个地区最多只能选择一个宝箱品质')
                  maskQuality = 1
                } else if (typeIds.has(wayTypeId)) {
                  maskWay = 1
                }
              })

              // 宝箱品质 和 获取方式 必须成对存在，不得孤立（异或取反）
              if (maskQuality ^ maskWay)
                throw new Error(
                  maskQuality
                    ? `须为【${areaName}】选择至少一个获取方式`
                    : `须为【${areaName}】选择一个宝箱品质`,
                )

              callback()
            })
          } catch (err) {
            callback(err as Error)
          }
        },
        trigger: 'change',
      },
    ],

    videoPath: [
      {
        validator: (_, videoPath: string = '') => {
          return !videoPath || /^https:\/\/www.bilibili.com\/video\/BV[a-zA-Z0-9]+/.test(videoPath)
        },
        message: '视频链接不正确(需要B站链接)',
        trigger: 'blur',
      },
    ],
  }

  return { rules }
}
