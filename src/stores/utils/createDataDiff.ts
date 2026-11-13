/** deck.gl 的区间更新描述（行号左闭右开） */
export interface DataDiffRange {
  startRow: number
  endRow?: number
}

export interface CreateDataDiffOptions {
  /**
   * 数组尾部保持不变的元素数量
   *
   * 例如临时点位（关联高亮、批量操作预览）总是被追加在正式点位之后，
   * 它们不随点位数据更新而变化，比较时应当跳过。
   */
  getTailCount?: () => number
}

/**
 * deck.gl `_dataDiff` 的签名
 *
 * 返回行区间数组时，deck.gl 只重新计算并上传这些行的顶点属性；
 * 返回全量区间（`startRow: 0`）则等价于整块重传。
 */
export type DataDiff = (data: unknown, oldData?: unknown) => DataDiffRange[]

const FULL: DataDiffRange = { startRow: 0 }

/**
 * # 为 deck.gl 生成区间更新描述
 *
 * 直接作为 `_dataDiff` 传给图层即可。它把新旧两份数据做「引用比较」，
 * 只在下标没有错位的前提下给出精确区间：
 * - 尾部追加：`[旧长度, 新长度)`，初始加载时每条分片只上传自己那一段
 * - 等长替换：`[首个变化, 末个变化 + 1)`
 * - 出现删除 / 重排（下标错位）时退回全量，保证不会画错
 *
 * 由于比较的是 deck.gl 自己持有的旧数据（`oldData`），
 * 中间层即使多次重算也不会产生「漏更新」。
 */
export const createDataDiff =
  (options: CreateDataDiffOptions = {}): DataDiff =>
  (data, oldData): DataDiffRange[] => {
    if (!Array.isArray(data) || !Array.isArray(oldData)) return [FULL]
    if (!data.length) return [FULL]
    if (!oldData.length) return data.length ? [{ startRow: 0, endRow: data.length }] : [FULL]

    const tail = Math.min(options.getTailCount?.() ?? 0, oldData.length, data.length)

    // 尾部元素必须逐项一致，否则说明临时点位等附加数据也变了
    for (let i = 0; i < tail; i++) {
      if (oldData[oldData.length - 1 - i] !== data[data.length - 1 - i]) return [FULL]
    }

    const headOld = oldData.length - tail
    const headNew = data.length - tail

    // 头部收缩意味着有点位被删除，其后的下标全部偏移，无法用区间描述
    if (headNew < headOld) return [FULL]

    // 找到第一处变化
    let start = 0
    while (start < headOld && oldData[start] === data[start]) start += 1

    if (headNew === headOld) {
      // 长度相同：只有内容被替换，区间可以精确到最后一处变化
      let last = headOld - 1
      while (last >= start && oldData[last] === data[last]) last -= 1
      if (last < start) return []
      return [{ startRow: start, endRow: last + 1 }]
    }

    // 长度增加：从第一处变化开始，一直覆盖到新增部分结束
    return [{ startRow: start, endRow: headNew }]
  }
