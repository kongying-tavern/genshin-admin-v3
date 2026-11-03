import type { ValuePacker } from '../types'
import type { MAFValue } from '@/stores/types'
import { decode as msgpackDecode, encode as msgpackEncode } from '@msgpack/msgpack'

/** 默认打包器：msgpack */
export const msgpackPacker: ValuePacker = {
  encode: value => msgpackEncode(value),
  decode: bytes => msgpackDecode(bytes) as MAFValue,
}
