import type { Props } from 'element-plus/es/components/select-v2/src/useProps.mjs'
import type {
  LoadFunction,
  TreeOptionProps,
} from 'element-plus/es/components/tree/src/tree.type.mjs'
import type { IconTypeVo } from '@/api/alova/globals'

export const ROOT_ICON_TYPE_ID = -1

const PAGE_SIZE = 128
const cache = new Map<number, Promise<IconTypeVo[]>>()
const revision = ref(0)

export const iconTypeRevision = readonly(revision)

export const invalidateIconTypes = () => {
  cache.clear()
  revision.value++
}

const fetchIconTypes = async (parentId: number) => {
  const types: IconTypeVo[] = []

  for (let current = 1; ; current++) {
    const { data } = await Apis.icon_type.listIconType({
      data: { typeIdList: [parentId], current, size: PAGE_SIZE },
    })
    const record = data?.record ?? []
    const { total, size = PAGE_SIZE } = data ?? {}
    types.push(...record)
    if (!record.length || (total === undefined ? record.length < size : types.length >= total)) {
      return types
    }
  }
}

export const getIconTypeList = (parentId = ROOT_ICON_TYPE_ID, useCache = true) => {
  const cached = cache.get(parentId)
  if (useCache && cached) return cached

  const request = fetchIconTypes(parentId).catch((error: unknown) => {
    if (cache.get(parentId) === request) cache.delete(parentId)
    throw error
  })
  cache.set(parentId, request)
  return request
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
  const load: LoadFunction = async (node, resolve, reject) => {
    const parentId = node.level === 0 ? ROOT_ICON_TYPE_ID : (node.data as IconTypeVo).id
    if (parentId === undefined) return resolve([])

    loading.value = true
    try {
      resolve(await getIconTypeList(parentId, useCache))
    } catch {
      reject()
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    props,
    load,
  }
}
