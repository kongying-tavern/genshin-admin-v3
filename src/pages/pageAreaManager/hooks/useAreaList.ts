import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

export const useAreaList = () => {
  const error = ref('')

  const {
    refresh: updateAreaList,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    immediate: true,
    initialValue: [],
    onRequest: async () => {
      const { data = [] } = await Apis.area.listArea({
        data: {
          isTraverse: true,
          parentId: -1,
        },
      })
      return data
    },
  })

  onError(err =>
    ElMessage.error({
      message: `获取地区列表失败，原因为：${err.message}`,
    }),
  )

  return { error, updateAreaList, onSuccess, ...rest }
}
