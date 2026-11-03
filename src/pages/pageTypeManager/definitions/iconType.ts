import type { PageListQueryParams, TypeManager } from '../config'
import type { IconTypeVo } from '@/api/alova/globals'

export class IconTypeManager implements TypeManager<IconTypeVo> {
  get info() {
    return {
      label: '图标类型',
    }
  }

  getId = (data: IconTypeVo) => data.id

  getName = (data: IconTypeVo) => `${data.name ?? `(id:${data.id})`}`

  getIsLeaf = (data: IconTypeVo) => data.isFinal

  list = (params: PageListQueryParams<IconTypeVo>) => {
    const { node, ...rest } = params
    return Apis.icon_type.listIconType({
      data: {
        typeIdList: node === undefined ? [-1] : [node.id!],
        ...rest,
      },
    })
  }

  create = (data: IconTypeVo, parent?: IconTypeVo) => {
    const { name } = data
    return Apis.icon_type.addIconType({
      data: {
        name,
        parentId: parent?.id ?? -1,
      },
    })
  }

  delete = (data: IconTypeVo) =>
    Apis.icon_type.deleteIconType({
      pathParams: {
        typeId: data.id!,
      },
    })

  update = (data: IconTypeVo) => Apis.icon_type.updateIconType({ data })
}
