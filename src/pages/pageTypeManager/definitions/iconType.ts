import type { PageListQueryParams, TypeManager } from '../config'
import type { IconTypeVo } from '@/api/alova/globals'
import { invalidateIconTypes, ROOT_ICON_TYPE_ID } from '@/hooks/useIconType'
import { useIconStore } from '@/stores/icon'

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
        typeIdList: [node?.id ?? ROOT_ICON_TYPE_ID],
        ...rest,
      },
    })
  }

  create = async (data: IconTypeVo, parent?: IconTypeVo) => {
    const { name } = data
    const result = await Apis.icon_type.addIconType({
      data: {
        name,
        parentId: parent?.id ?? ROOT_ICON_TYPE_ID,
      },
    })
    if (!result.data) throw new Error(result.message || '新增分类失败')
    invalidateIconTypes()
    return result
  }

  delete = async (data: IconTypeVo) => {
    const { id } = data
    if (id === undefined) throw new Error('分类 id 为空')
    const result = await Apis.icon_type.deleteIconType({
      pathParams: { typeId: id },
    })
    if (!result.data) throw new Error(result.message || '删除分类失败')
    useIconStore().removeDeletedCategory(id)
    invalidateIconTypes()
    return result
  }

  update = async (data: IconTypeVo) => {
    const result = await Apis.icon_type.updateIconType({ data })
    if (!result.data) throw new Error(result.message || '更新分类失败')
    invalidateIconTypes()
    return result
  }
}
