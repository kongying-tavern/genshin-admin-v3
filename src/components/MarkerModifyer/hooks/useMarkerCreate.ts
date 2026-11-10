import type { Ref, ShallowRef } from 'vue'
import type { MarkerForm } from '../components'
import type { MarkerVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { omit } from 'lodash'
import { useFetchHook } from '@/hooks'
import { useMarkerStore, useUserStore } from '@/stores'
import { usePictureUpload } from './usePictureUpload'

/** 新增点位，已自动处理 version 和 methodType 字段 */
export const useMarkerCreate = (
  markerData: Ref<MarkerVo | null>,
  editorRef: ShallowRef<InstanceType<typeof MarkerForm>>,
) => {
  const userStore = useUserStore()
  const markerStore = useMarkerStore()

  const commonKeys: (keyof MarkerVo)[] = ['updateTime', 'createTime']

  const buildAdminMarkerForm = (marker: MarkerVo): MarkerVo => {
    return {
      ...omit(marker, commonKeys),
      pictureCreatorId: marker.picture ? userStore.info?.id : undefined,
    }
  }

  const { tryUploadPicture } = usePictureUpload()

  /**
   * 用于解决以下问题:
   * 在请求成功到弹窗关闭的间隙内 loading 会重置，此时双击提交会导致重复请求。
   */
  const isSuccess = ref(false)

  /** 是否存在正在进行的提交 */
  const isSubmitting = ref(false)

  const {
    refresh: request,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async () => {
      if (!markerData.value) throw new Error('表单数据为空')
      await editorRef.value?.validate()
      const form = buildAdminMarkerForm(markerData.value)
      await tryUploadPicture(form)
      await markerStore.createMarker(form)
    },
  })

  /**
   * 提交新增（带防止重复提交的同步锁）
   * loading 需要等待 DOM 更新后才会禁用按钮，极快双击时第二次点击可能先于此触发；
   * 并且 refresh 被重复调用时会中止上一次调用并再次发起请求，无法阻止重复写入。
   * 因此需要在调用入口同步加锁，仅在失败时解锁以允许重试。
   */
  const submit = async () => {
    if (isSubmitting.value || isSuccess.value) return
    isSubmitting.value = true
    try {
      return await request()
    } finally {
      if (!isSuccess.value) isSubmitting.value = false
    }
  }

  onSuccess(async () => {
    isSuccess.value = true
    ElMessage.success({
      message: '新增点位成功',
    })
  })

  onError(err =>
    ElMessage.error({
      message: `新增点位失败，原因为：${err.message}`,
    }),
  )

  return { isSuccess, submit, onSuccess, onError, ...rest }
}
