import type { ShallowRef } from 'vue'
import type { IconVo } from '@/api/alova/globals'
import { renderTagSprite } from '@/worker/tagSpriteRenderer'

/** 图标纹理 - 预渲染 */
export const useIconTextureRender = () => {
  /** 图标纹理 */
  const texture = shallowRef<Blob>()

  /** 图标纹理 url */
  const textureUrl = ref<string | undefined>()

  watch(texture, () => {
    textureUrl.value && URL.revokeObjectURL(textureUrl.value)
    textureUrl.value = texture.value ? URL.createObjectURL(texture.value) : undefined
  })

  /** 图标到坐标的映射 */
  const positionList = shallowRef<DBType.IconSprite['positionList']>([])

  /**
   * tag 位置索引表
   * @deprecated
   */
  const positionMap = computed(() => {
    const res: Record<string, [number, number]> = {}
    positionList.value.forEach(({ ids: tags, pos }) => {
      tags.forEach(tag => {
        res[tag] = pos
      })
    })
    return res
  })

  /** 位置索引表 */
  const coordMap = computed(() =>
    positionList.value.reduce((map, { ids, pos }) => {
      ids.forEach(id => map.set(id, pos))
      return map
    }, new Map<number, [x: number, y: number]>()),
  )

  /** 预渲染标签精灵图 */
  const refresh = async (list: IconVo[]) => {
    const iconList = list.flatMap(icon => {
      if (!icon.id || !icon.url) return []
      try {
        const url = new URL(icon.url)
        url.searchParams.set('with_origin', '1')
        return [
          {
            id: icon.id,
            src: url.toString(),
          },
        ]
      } catch {
        // 跳过不符合 url 格式的图标，避免中断整个预渲染流程
        console.warn(`[useIconTextureRender] 图标 url 无效，已跳过：${icon.id}`, icon.url)
        return []
      }
    })

    const renderResult = await renderTagSprite({
      // oss 限制最大并发 50，这里给个保守值
      maxRequests: 40,
      // 绕过 cdn 以避免 cdn 缓存导致的问题
      iconList,
    })
    texture.value = new Blob([renderResult.texture], { type: 'image/png' })
    positionList.value = renderResult.positionList
  }

  return {
    texture: texture as Readonly<ShallowRef<Blob | undefined>>,
    textureUrl: textureUrl as Readonly<Ref<string | undefined>>,
    positionMap: positionMap as Readonly<ShallowRef<Record<string, [number, number]>>>,
    coordMap,
    positionList: positionList as Readonly<ShallowRef<DBType.IconSprite['positionList']>>,
    refresh,
  }
}
