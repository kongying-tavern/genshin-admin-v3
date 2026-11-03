export interface Array2TreeOptions<T, C, I> {
  /** 子节点数组的 key 名 */
  childrenKey: C
  /** 当前节点 id */
  getId: (item: T) => I
  /** 父节点 id */
  getPid: (item: T) => I
  /** 根级节点的 id 号 */
  rootId: I
}

type AddChildrenKeyToObject<T, K extends string> = {
  [P in keyof T | K]: P extends keyof T ? T[P] : AddChildrenKeyToObject<T, K>[]
}

/**
 * 将数组转换为具有上下级关系的树形结构
 * 每个对象必须包含能判断父子级关系的字段
 */
export const array2Tree = <T extends object, C extends string, I extends string | number>(
  items: T[],
  options: Array2TreeOptions<T, C, I>,
) => {
  const { childrenKey, getId, getPid, rootId } = options

  const itemMap = items.reduce(
    (map, item) =>
      map.set(getId(item), {
        ...item,
        [childrenKey]: [],
      } as AddChildrenKeyToObject<T, C>),
    new Map<I, AddChildrenKeyToObject<T, C>>(),
  )

  return items.reduce(
    (result, item) => {
      const id = getId(item)
      const pid = getPid(item)
      const covertItem = itemMap.get(id)!
      if (pid !== rootId) {
        void (itemMap.get(pid)?.[childrenKey] as AddChildrenKeyToObject<T, C>[] | undefined)?.push(
          covertItem,
        )
        return result
      }
      result.push(covertItem)
      return result
    },
    [] as AddChildrenKeyToObject<T, C>[],
  )
}
