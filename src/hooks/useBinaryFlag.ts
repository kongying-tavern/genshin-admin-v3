/**
 * 将一个数值转换为二进制标识列表进行处理
 */
export const useBinaryFlag = <T extends Record<string, number>>(
  flagNumber: MaybeRef<number | undefined>,
  binaryIndexMap: T,
) => {
  const flagBoolMap = computed({
    get: () => {
      const binaryBits = (toValue(flagNumber) ?? 0).toString(2).split('').map(Number).reverse()
      const boolMap = {} as Record<keyof typeof binaryIndexMap, boolean>
      for (const key in binaryIndexMap) boolMap[key] = Boolean(binaryBits[binaryIndexMap[key]])
      return boolMap
    },
    set: boolMap => {
      if (!isRef(flagNumber)) return false
      const binaryBits: number[] = []
      for (const key in binaryIndexMap) binaryBits[binaryIndexMap[key]] = Number(boolMap[key])
      flagNumber.value = Number(`0b${binaryBits.reverse().join('')}`)
    },
  })

  const modelFlag = <K extends keyof T>(key: K) =>
    computed({
      get: () => flagBoolMap.value[key],
      set: v => {
        flagBoolMap.value = {
          ...flagBoolMap.value,
          [key]: v,
        }
      },
    })

  const returns = {} as Record<keyof T, Ref<boolean>>

  for (const key in binaryIndexMap) returns[key] = modelFlag(key)

  return returns
}
