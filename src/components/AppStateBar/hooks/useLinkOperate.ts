import type { ModifyLinkOptions } from '../components/MarkerLink'
import { useMapStateStore } from '@/stores'

/**
 * 正在编辑的关联项
 * - key 表示的意义
 * `${minMarkerId}-${maxMarkerId}-${linkAction}`
 */
const modifyLinks = ref(new Map<string, ModifyLinkOptions>())

export const useLinkOperate = () => {
  const mapStateStore = useMapStateStore()

  const { isEnable, isProcessing, update } = mapStateStore.subscribeMission('markerLink', () => [])

  /** 删除关联 */
  const deleteLink = (linkKey: string, options: ModifyLinkOptions) => {
    const currentLink = modifyLinks.value.get(linkKey)!
    if (!currentLink) return
    // 对于具有原始组的关联（即并非本地关联）需要添加为删除项而不是简单的从表中移除
    if (options.raw.groupId) modifyLinks.value.set(linkKey, { ...options, isDelete: true })
    // 对于本地项直接删除即可
    else modifyLinks.value.delete(linkKey)
    triggerRef(modifyLinks)
  }

  /** 将自动合并的关联提取为手动编辑 */
  const extractLink = (linkKey: string, options: ModifyLinkOptions) => {
    if (!isEnable.value) return
    if (!isProcessing.value) update([])
    modifyLinks.value.set(linkKey, {
      ...options,
      isMerge: false,
    })
    triggerRef(modifyLinks)
  }

  /** 恢复关联（仅针对含有原始组的关联） */
  const revestLink = (linkKey: string, options: ModifyLinkOptions) => {
    const currentLink = modifyLinks.value.get(linkKey)!
    if (!currentLink || !options.raw.groupId) return
    modifyLinks.value.delete(linkKey)
  }

  return {
    modifyLinks,
    deleteLink,
    extractLink,
    revestLink,
  }
}
