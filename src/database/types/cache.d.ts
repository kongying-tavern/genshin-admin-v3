type CovertMapToSchemas<T> = {
  [K in keyof T]: {
    id: K
    value: T[K]
    digest: string
  }
}[keyof T]

declare namespace DBType {
  /** 图标的精灵图信息缓存 */
  interface IconSprite {
    /** 缓存版本 */
    version?: number
    /** 纹理文件 */
    texture: ArrayBuffer
    /** 文件签名 */
    digest: string
    /** 图标 id 到渲染坐标的映射 */
    positionList: {
      ids: number[]
      pos: [x: number, y: number]
    }[]
  }

  /** 点位的精灵图信息缓存 */
  interface MarkerSprite {
    /** 纹理文件 */
    texture: ArrayBuffer
    /** 文件签名 */
    digest: string
    /** 所用的 icon 纹理的签名 */
    iconSpriteDigest: string
    /** 点位 key 到纹理坐标的映射 */
    mapping: Record<
      string,
      {
        x: number
        y: number
        width: number
        height: number
        anchorX?: number
        anchorY?: number
      }
    >
  }

  /** dadian json 订阅缓存 */
  interface DadianJSON {
    digest: string
    json: DTO.DadianJSON
  }

  /** file 缓存 */
  interface FileCache {
    name: string
    buffer: ArrayBuffer
  }

  /** 实体缓存类型表 */
  interface CacheTypes {
    iconSprite: IconSprite
    markerSprite: MarkerSprite
    dadian: DTO.DadianJSON
  }

  /** 实体缓存 */
  type InstancedCache = CovertMapToSchemas<CacheTypes>
}
