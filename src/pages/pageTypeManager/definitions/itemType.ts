import type { PageListQueryParams, TypeManager } from '../config'
import type { ItemTypeVo } from '@/api/alova/globals'

export class ItemTypeManager implements TypeManager<ItemTypeVo> {
  get info() {
    return {
      label: '物品类型',
    }
  }

  getId = (data: ItemTypeVo) => data.id

  getName = (data: ItemTypeVo) => `${data.name ?? `(id:${data.id})`}`

  getIsLeaf = (data: ItemTypeVo) => data.isFinal

  list = (params: PageListQueryParams<ItemTypeVo>) => {
    const { node, ...rest } = params
    return Apis.item_type.listItemType_1({
      pathParams: { self: 1 },
      data: {
        typeIdList: node === undefined ? [-1] : [node.id!],
        ...rest,
      },
    })
  }

  create = (data: ItemTypeVo, parent?: ItemTypeVo) => {
    const { name, content = '', iconId, sortIndex, hiddenFlag } = data
    return Apis.item_type.addItemType({
      data: {
        name,
        content,
        iconId,
        sortIndex,
        hiddenFlag,
        parentId: parent?.id ?? -1,
      },
    })
  }

  delete = (data: ItemTypeVo) =>
    Apis.item_type.deleteItemType({
      pathParams: {
        itemTypeId: data.id!,
      },
    })

  update = (data: ItemTypeVo) => Apis.item_type.updateItemType({ data })
}
