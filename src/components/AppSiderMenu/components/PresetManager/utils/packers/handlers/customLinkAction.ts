import type { ValuePacker } from '../types'
import type { MAFValue, MAFValueStringArray } from '@/stores/types'
import { LinkActionEnum } from '@/shared/linkAction'
import { ByteReader, ByteWriter } from '@/utils'

/** 关联动作 → 位图 bit 位置映射（1-based，MSB-first） */
const LINK_ACTION_BITS: (readonly [action: LinkActionEnum, bit: number])[] = [
  [LinkActionEnum.TRIGGER, 4],
  [LinkActionEnum.TRIGGER_ALL, 3],
  [LinkActionEnum.TRIGGER_ANY, 2],
  [LinkActionEnum.RELATED, 8],
  [LinkActionEnum.DIRECTED, 7],
  [LinkActionEnum.PATH_UNI_DIR, 12],
  [LinkActionEnum.PATH_BI_DIR, 11],
  [LinkActionEnum.EQUIVALENT, 16],
]

/**
 * 关联动作编码格式（固定 2 字节位图）：
 *   第一字节前4位 0xyz：z=TRIGGER, y=TRIGGER_ALL, x=TRIGGER_ANY
 *   第一字节后4位 00xy：y=RELATED, x=DIRECTED
 *   第二字节前4位 00xy：y=PATH_UNI_DIR, x=PATH_BI_DIR
 *   第二字节后4位 000x：x=EQUIVALENT
 */
const encode = (value: MAFValue): Uint8Array => {
  const { sa } = value as MAFValueStringArray
  const saSet = new Set(sa)
  const writer = new ByteWriter().writeUint16LE(0).moveTo(0)

  for (const [action, bit] of LINK_ACTION_BITS) {
    if (saSet.has(action)) writer.setBit(0b1, bit, bit)
  }

  return writer.toUint8Array()
}

const decode = (bytes: Uint8Array): MAFValueStringArray => {
  const reader = new ByteReader(bytes)
  const sa: string[] = []

  for (const [action, bit] of LINK_ACTION_BITS) {
    if (reader.readBit(bit, bit, 'blank')) sa.push(action)
  }

  return { sa }
}

export const customLinkActionPacker: ValuePacker = { encode, decode }
