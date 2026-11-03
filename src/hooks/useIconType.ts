import type { Props } from 'element-plus/es/components/select-v2/src/useProps.mjs'
import type Node from 'element-plus/es/components/tree/src/model/node.mjs'
import type { TreeOptionProps } from 'element-plus/es/components/tree/src/tree.type.mjs'
import type { IconTypeVo } from '@/api/alova/globals'

const cache = ref<Map<number, IconTypeVo[]>>(new Map())

const getIconTypeList = async (parentId = -1, size = 128, useCache = false) => {
  if (useCache && cache.value.has(parentId)) return cache.value.get(parentId)!
  const { data: { record = [] } = {} } = await Apis.icon_type.listIconType({
    data: {
      typeIdList: [parentId],
      current: 1,
      size,
    },
  })
  cache.value.set(parentId, record)
  return record
}

/** 可供 el-tree 或者 el-tree-select 使用的树形结构图标类型数据 */
export const useIconType = (useCache = true) => {
  const props: TreeOptionProps & Props = {
    label: 'name',
    value: 'id',
    isLeaf: 'isFinal',
  }

  const loading = ref(false)

  /** 懒加载树形类型列表 */
  const load = (node: Node, resolve: (data: IconTypeVo[]) => void) => {
    loading.value = true
    if (node.level === 0) {
      getIconTypeList(-1, 128, useCache)
        .then(resolve)
        .catch(() => resolve([]))
        .finally(() => {
          loading.value = false
        })
      return
    }
    const { id } = node.data as IconTypeVo
    if (id === undefined) {
      loading.value = false
      resolve([])
      return
    }
    getIconTypeList(id, 128, useCache)
      .then(resolve)
      .catch(() => resolve([]))
      .finally(() => {
        loading.value = false
      })
  }

  return {
    loading,
    props,
    load,
  }
}
