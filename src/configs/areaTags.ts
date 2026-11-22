import source from './areaTags.json'

export type AreaTagLevel = 0 | 1 | 2

export type AreaTagTuple = [
  text: string,
  /** 相对于底图中心的坐标，锚点位于文字包围盒中心 */
  position: DTO.Coordinate2D,
  /** 0 为区级（默认），1 为块级，2 为国级 */
  level?: AreaTagLevel,
]

type AreaTags = Record<string, AreaTagTuple[]>

export const areaTags = shallowRef(source as unknown as AreaTags)

if (import.meta.hot) {
  import.meta.hot.accept('./areaTags.json', module => {
    if (module) areaTags.value = module.default as AreaTags
  })
}

export const groupAreaTags = (tags: Iterable<AreaTagTuple>): AreaTagTuple[][] => {
  const groups: AreaTagTuple[][] = []
  for (const tag of tags) {
    const group = (groups[tag[2] ?? 0] ??= [])
    group.push(tag)
  }
  return groups
}
