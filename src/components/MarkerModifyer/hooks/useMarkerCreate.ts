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

  const {
    refresh: submit,
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
