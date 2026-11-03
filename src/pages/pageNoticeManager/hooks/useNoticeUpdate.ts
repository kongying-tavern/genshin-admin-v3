import type { NoticeVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

export const useNoticeUpdate = () => {
  const {
    refresh: updateNotice,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async (notice: NoticeVo) => {
      await Apis.notice.updateNotice({ data: notice })
    },
  })

  onSuccess(() => {
    ElMessage.success({
      message: '编辑公告成功',
    })
  })

  onError(err => {
    ElMessage.error({
      message: `编辑公告失败，原因为：${err.message}`,
    })
  })

  return {
    updateNotice,
    ...rest,
  }
}
