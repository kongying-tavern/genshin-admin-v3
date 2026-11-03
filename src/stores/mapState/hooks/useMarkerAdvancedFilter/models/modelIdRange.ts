import type { MarkerVo } from '@/api/alova/globals'
import type {
  MAFConfig,
  MAFMetaIdRange,
  MAFOptionInput,
  MAFSemanticUnit,
  MAFValueString,
} from '@/stores/types'
import { MAF_MODEL_META_MAP, MAFModelId } from '@/shared'

export class IdRange implements MAFConfig<MAFValueString, MAFOptionInput, MAFMetaIdRange> {
  id = MAFModelId.ID_RANGE
  name = MAF_MODEL_META_MAP[MAFModelId.ID_RANGE].name
  option: MAFOptionInput = {
    placeholder: '格式：1,2,3-5',
  }

  get defaultVal(): MAFValueString {
    return {
      s: '',
    }
  }

  prepare(val: MAFValueString, _opt: MAFOptionInput): MAFMetaIdRange {
    const meta: MAFMetaIdRange = {
      idRange: [],
      idSet: new Set<number>(),
    }

    // 处理ID区间
    const isValidNumber = (num: number): boolean =>
      Number.isInteger(num) && num > 0 && num <= 2 ** 32 - 1
    if (val.s) {
      const ids: string[] = val.s.split(',').filter(v => v)
      ids.forEach(id => {
        if (id.includes('-')) {
          const idNums: string[] = id.split('-')
          const idNum1: number = Number(idNums.shift())
          const idNum2: number = Number(idNums.join('-'))
          if (
            isValidNumber(idNum1)
            && isValidNumber(idNum2)
            && idNum2 > idNum1
            && idNum2 - idNum1 < 1e6
          ) {
            meta.idRange.push([idNum1, idNum2])
          }
        } else {
          const idNum: number = Number(id)
          if (isValidNumber(idNum)) meta.idRange.push(idNum)
        }
      })
    }

    // 处理ID范围
    meta.idRange.forEach(idRange => {
      if (Array.isArray(idRange)) {
        if (idRange.length < 2) throw new Error('数组所需的元素数量不满足最低要求')
        const idNum1 = idRange[0]
        const idNum2 = idRange[1]
        Array.from({ length: idNum2 - idNum1 + 1 })
          .fill(0)
          .forEach((_, offset) => meta.idSet.add(idNum1 + offset))
      } else if (isValidNumber(idRange)) {
        meta.idSet.add(idRange as number)
      }
    })

    return meta
  }

  semantic(
    _val: MAFValueString,
    _opt: MAFOptionInput,
    meta: MAFMetaIdRange,
    opposite: boolean,
  ): (MAFSemanticUnit | null)[] {
    const idTags: string = meta.idRange
      .map(range => (Array.isArray(range) ? `${range[0]}-${range[1]}` : `${range}`))
      .join(', ')
    return [
      { type: 'text', text: 'ID范围' },
      opposite ? { type: 'opposite-indicator', text: '不' } : null,
      { type: 'text', text: '为' },
      { type: 'number', text: idTags },
    ]
  }

  filter(
    _val: MAFValueString,
    _opt: MAFOptionInput,
    meta: MAFMetaIdRange,
    marker: MarkerVo,
  ): boolean {
    return meta.idSet.has(marker.id!)
  }
}
