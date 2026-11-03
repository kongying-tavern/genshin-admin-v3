import type { NoticeVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

export const useNoticeCreate = () => {
  const {
    refresh: createNotice,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async (notice: NoticeVo) => {
      await Apis.notice.createNotice({ data: notice })
    },
  })

  onSuccess(() => {
    ElMessage.success({
      message: '新增公告成功',
    })
  })

  onError(err => {
    ElMessage.error({
      message: `新增公告失败，原因为：${err.message}`,
    })
  })

  return {
    createNotice,
    ...rest,
  }
}
