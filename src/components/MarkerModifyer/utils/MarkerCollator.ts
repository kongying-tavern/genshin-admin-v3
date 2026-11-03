import type { MarkerItemLinkVo, MarkerVo } from '@/api/alova/globals'

export class MarkerCollator {
  static compare = (a: MarkerVo, b: MarkerVo) => {
    const differentKeys = new Set<string>()

    const checkDifferent = (key: string, condition: boolean) => {
      condition && differentKeys.add(key)
    }

    checkDifferent('id', a.id !== b.id)
    checkDifferent('hiddenFlag', a.hiddenFlag !== b.hiddenFlag)
    checkDifferent('refreshTime', a.refreshTime !== b.refreshTime)
    checkDifferent('markerTitle', a.markerTitle !== b.markerTitle)
    checkDifferent('linkageId', a.linkageId !== b.linkageId)
    checkDifferent('videoPath', a.videoPath !== b.videoPath)
    checkDifferent('position', a.position !== b.position)
    checkDifferent('picture', a.picture !== b.picture)
    checkDifferent('content', a.content !== b.content)
    checkDifferent('extra', JSON.stringify(a.extra ?? {}) !== JSON.stringify(b.extra ?? {}))
    checkDifferent('itemList', this.isItemDifferent(a.itemList, b.itemList))

    return differentKeys
  }

  private static isItemDifferent = (a: MarkerItemLinkVo[] = [], b: MarkerItemLinkVo[] = []) => {
    const itemCountMap = a.reduce(
      (map, { itemId, count = 0 }) => map.set(itemId!, count),
      new Map<number, number>(),
    )

    b.forEach(({ itemId, count = 0 }) => {
      const newOne = itemCountMap.get(itemId!)
      if (newOne === undefined || newOne !== count) {
        itemCountMap.set(itemId!, count)
        return
      }
      itemCountMap.delete(itemId!)
    })

    return itemCountMap.size > 0
  }
}
