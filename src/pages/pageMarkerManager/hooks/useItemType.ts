import { useTypeList } from '@/hooks'

/** 拉取物品类型 */
export const useItemType = () => {
  const { typeList } = useTypeList({ immediate: true })

  const typeOptions = computed(() =>
    typeList.value
      .filter(itemType => itemType.isFinal)
      .map(itemType => ({
        label: `${itemType.name}`,
        value: itemType.id,
      })),
  )

  return { typeList, typeOptions }
}
