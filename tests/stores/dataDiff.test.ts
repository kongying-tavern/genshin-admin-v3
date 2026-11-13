import { describe, expect, it } from 'vitest'
import { createDataDiff } from '@/stores/utils'

/**
 * 单元测试：deck.gl 区间更新描述（`src/stores/utils/createDataDiff.ts`）
 *
 * 这里的分支直接决定 GPU 顶点属性会上传多少行，写错了会出现
 * 「新点位不显示」或「旧点位位置错乱」，因此逐条覆盖。
 */

const item = (id: number) => ({ id })

describe('createDataDiff', () => {
  it('没有旧数据时退回全量', () => {
    const diff = createDataDiff()
    expect(diff([item(1), item(2)], undefined)).toEqual([{ startRow: 0 }])
  })

  it('尾部追加时只上传新增行', () => {
    const diff = createDataDiff()
    const a = item(1)
    const b = item(2)
    const c = item(3)
    const d = item(4)

    expect(diff([a, b, c], [a, b])).toEqual([{ startRow: 2, endRow: 3 }])
    expect(diff([a, b, c, d], [a, b, c])).toEqual([{ startRow: 3, endRow: 4 }])
    // 一次追加多行
    expect(diff([a, b, c, d], [a, b])).toEqual([{ startRow: 2, endRow: 4 }])
  })

  it('等长替换时区间精确到最后一次变化', () => {
    const diff = createDataDiff()
    const [a, b, c, d] = [item(1), item(2), item(3), item(4)]
    const b2 = item(2)

    // 只替换了第 2 项
    expect(diff([a, b2, c, d], [a, b, c, d])).toEqual([{ startRow: 1, endRow: 2 }])
  })

  it('内容完全一致时不产生任何区间', () => {
    const diff = createDataDiff()
    const a = item(1)
    const b = item(2)

    expect(diff([a, b], [a, b])).toEqual([])
  })

  it('出现删除或重排时退回全量，避免下标错位', () => {
    const diff = createDataDiff()
    const a = item(1)
    const b = item(2)
    const c = item(3)

    // 删除中间项：下标整体前移，只能整块重传
    expect(diff([a, c], [a, b, c])).toEqual([{ startRow: 0 }])

    // 重排：长度不变但每一行都可能变了
    expect(diff([c, a, b], [a, b, c])).toEqual([{ startRow: 0, endRow: 3 }])
  })

  it('尾部临时点位不参与比较', () => {
    const tail = [item(-1), item(-2)]
    const diff = createDataDiff({ getTailCount: () => tail.length })

    const a = item(1)
    const b = item(2)

    // 正式点位追加在临时点位之前，只上传新增的正式点位
    expect(diff([a, b, ...tail], [a, ...tail])).toEqual([{ startRow: 1, endRow: 2 }])

    // 临时点位自身发生变化时无法用区间表达，退回全量
    const diff2 = createDataDiff({ getTailCount: () => tail.length })
    expect(diff2([a, item(-3), item(-4)], [a, ...tail])).toEqual([{ startRow: 0 }])
  })

  it('空数组与非数组输入不会抛错', () => {
    const diff = createDataDiff()
    expect(diff([], [])).toEqual([{ startRow: 0 }])
    expect(diff(undefined, [item(1)])).toEqual([{ startRow: 0 }])
    expect(diff([item(1)], undefined)).toEqual([{ startRow: 0 }])
  })
})
