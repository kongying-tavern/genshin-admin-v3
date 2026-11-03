import type { IconLayerProps } from 'deck.gl'
import type { ShallowRef } from 'vue'
import { renderMarkerSprite } from '@/worker/markerSpriteRenderer'

export interface MarkerSpriteHookOptions {
  /** 图标纹理 */
  iconTexture: Readonly<ShallowRef<Blob | undefined>>
  /** 图标 id 到纹理坐标的映射 */
  positionList: Readonly<ShallowRef<DBType.IconSprite['positionList']>>
}

/** 点位纹理 - 预渲染 */
export const useMarkerTextureRender = (options: MarkerSpriteHookOptions) => {
  const { iconTexture, positionList } = options

  const texture = shallowRef<Blob>()

  const textureUrl = useObjectUrl(texture)

  /** 标签 mapping  */
  const markerSpriteMapping = shallowRef<
    Exclude<NonNullable<IconLayerProps['iconMapping']>, string>
  >({})

  const states: { state: string; color: string }[] = [
    { state: 'default', color: '#FFFFFF' },
    { state: 'hover', color: '#DDDDDD' },
    { state: 'focus', color: '#FFFF00' },
    { state: 'marked', color: '#00FFFD' },
  ]

  const refreshSpriteImage = async () => {
    if (!iconTexture.value) return

    const res = await renderMarkerSprite({
      states,
      positionList: positionList.value,
      texture: await iconTexture.value.arrayBuffer(),
    })

    texture.value = new Blob([res.texture], { type: 'image/png' })
    markerSpriteMapping.value = res.mapping
  }

  watch(iconTexture, refreshSpriteImage)

  return {
    markerSpriteImage: texture,
    markerSpriteUrl: textureUrl,
    markerSpriteMapping,
    refreshSpriteImage,
  }
}
