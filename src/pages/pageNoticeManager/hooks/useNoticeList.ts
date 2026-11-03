import type { NoticeSearchVo } from '@/api/alova/globals'
import type { PaginationState } from '@/hooks'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

interface NoticeHookOptions {
  pagination: Ref<PaginationState>
  getParams: () => Omit<NoticeSearchVo, 'current' | 'size'>
}

export const useNoticeList = (options: NoticeHookOptions) => {
  const { pagination, getParams } = options

  const {
    data: noticeList,
    onError,
    ...rest
  } = useFetchHook({
    shallow: true,
    initialValue: [],
    immediate: true,
    onRequest: async () => {
      const { current, pageSize } = toValue(pagination)
      const { channels = [], getValid, sort = [], title } = getParams()
      const { data: { record = [], total = 0 } = {} } = await Apis.notice.listNotice({
        data: {
          current,
          size: pageSize,
          channels,
          getValid: getValid || undefined,
          sort,
          title,
        },
      })
      pagination.value.total = total
      return record
    },
  })

  onError(err => {
    ElMessage.error({
      message: `请求公告列表失败，原因为：${err.message}`,
    })
  })

  return {
    noticeList,
    onError,
    ...rest,
  }
}
