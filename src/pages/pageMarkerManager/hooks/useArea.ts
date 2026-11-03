import { useFetchHook } from '@/hooks'

/** 拉取地区列表 */
export const useArea = () => {
  const areaList = ref<
    {
      label: string
      value: number
    }[]
  >([])

  const {
    refresh: getArea,
    onSuccess,
    ...rest
  } = useFetchHook({
    immediate: true,
    onRequest: async () => {
      return Apis.area.listArea({
        data: {
          parentId: -1,
          isTraverse: true,
        },
      })
    },
  })

  onSuccess(({ data = [] }) => {
    areaList.value = data.map(({ id, name }) => ({
      label: name ?? '',
      value: id ?? -9999,
    }))
  })

  return { getArea, areaList, ...rest }
}
