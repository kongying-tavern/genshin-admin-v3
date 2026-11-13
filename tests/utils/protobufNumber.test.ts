import { describe, expect, it } from 'vitest'
import { toNumber, toOptionalNumber } from '@/api/protobuf/toNumber'

/**
 * 单元测试：protobuf 64 位整型收敛（`src/api/protobuf/toNumber.ts`）
 *
 * 背景：接口返回的二进制数据中 `uint64` 会被 long 库解码成
 * `{ low, high, unsigned }` 实例，若直接当作 number 使用，
 * 请求体会序列化成对象、Map 索引永远命中不了、IndexedDB 主键也会被判非法。
 */

/** 模拟 protobufjs + long 的解码结果 */
const long = (low: number, high = 0, unsigned = true) => ({ low, high, unsigned })

describe('toNumber', () => {
  it('普通数值原样返回', () => {
    expect(toNumber(10853)).toBe(10853)
    expect(toNumber(0)).toBe(0)
  })

  it('把 unsigned Long 实例还原为数值', () => {
    expect(toNumber(long(10853))).toBe(10853)
    expect(toNumber(long(1, 1))).toBe(4294967297)
  })

  it('支持有符号 Long 实例', () => {
    expect(toNumber(long(0xffffffff, 0xffffffff, false))).toBe(-1)
    expect(toNumber(long(0, 0, false))).toBe(0)
  })

  it('优先使用实例上的 toNumber 方法', () => {
    expect(toNumber({ low: 0, high: 0, unsigned: true, toNumber: () => 42 })).toBe(42)
  })

  it('缺省值按兜底处理', () => {
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber(null, -1)).toBe(-1)
    expect(toNumber(Number.NaN, 7)).toBe(7)
  })

  it('toOptionalNumber 对缺省值保持 undefined', () => {
    expect(toOptionalNumber(null)).toBeUndefined()
    expect(toOptionalNumber(undefined)).toBeUndefined()
    expect(toOptionalNumber(long(9))).toBe(9)
    expect(toOptionalNumber(0)).toBe(0)
  })
})
