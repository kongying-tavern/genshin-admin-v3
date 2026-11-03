import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useMarkerExtraStore } from '@/stores'
import { md5ToBigInt } from '@/utils'

/** 汇总所有地区的地下分层层级 code */
const collectLayerCodes = (areaExtraConfigs: Record<string, DTO.ExtraConfig>): string[] => {
  const codes: string[] = []
  for (const areaCode in areaExtraConfigs) {
    const { underground = {} } = areaExtraConfigs[areaCode]
    const { levels = [] } = underground
    for (const group of levels) {
      for (const item of group.children ?? []) codes.push(item.value)
    }
  }
  return codes
}

/** 分层层级 code 列表与 MD5 哈希双向映射（响应式，随地区额外配置变化） */
export const usePackUndergroundLayerContext = () => {
  const { mergedAreaExtraConfigs } = storeToRefs(useMarkerExtraStore())

  /** 全部分层层级 code 列表 */
  const codes = computed(() => collectLayerCodes(mergedAreaExtraConfigs.value))

  /** code → 24 位 MD5 哈希 */
  const codeToHashMap = computed(() => {
    const map = new Map<string, bigint>()
    for (const code of codes.value) map.set(code, md5ToBigInt(code, 1, 3))
    return map
  })

  /** 24 位 MD5 哈希 → code */
  const hashToCodeMap = computed(() => {
    const map = new Map<bigint, string>()
    for (const code of codes.value) map.set(md5ToBigInt(code, 1, 3), code)
    return map
  })

  return {
    codes,
    codeToHashMap,
    hashToCodeMap,
  }
}
