import type { Ref } from 'vue'
import type { MarkerForm } from '../components'
import type { MarkerVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { omit } from 'lodash'
import { useFetchHook } from '@/hooks'
import { useMarkerStore, useUserStore } from '@/stores'
import { usePictureUpload } from './usePictureUpload'

/** 编辑点位，已自动处理 methodType 字段 */
export const useMarkerEdit = (
  markerData: Ref<MarkerVo | null>,
  editorRef: Ref<InstanceType<typeof MarkerForm> | null>,
) => {
  const userStore = useUserStore()
  const markerStore = useMarkerStore()

  /**
   * 基于 url 参数传递来判断 picture 是否已经更改
   * 此处对 picture 传递过来的 url 上的参数 timestamp、和 last-modified 进行判断和处理
   */
  const checkPictureChange = (marker: MarkerVo) => {
    const { picture = '' } = marker
    if (!picture) return false

    const pictureURL = new URL(picture)
    const params = pictureURL.searchParams
    const timestamp = Number(params.get('timestamp'))
    const lastModified = Number(params.get('last-modified'))

    const isChanged =
      !Number.isNaN(timestamp) && !Number.isNaN(lastModified) && timestamp > lastModified

    if (isChanged) {
      !lastModified && params.set('last-modified', `${new Date().getTime()}`)
      params.delete('timestamp')
      marker.picture = `${pictureURL.origin}${pictureURL.pathname}?${params.toString()}`
    }

    return isChanged
  }

  const commonKeys: (keyof MarkerVo)[] = ['updateTime', 'createTime']

  const buildAdminMarkerForm = (marker: MarkerVo): MarkerVo => {
    const isPictureChanged = checkPictureChange(marker)
    return {
      ...omit(marker, commonKeys),
      pictureCreatorId: isPictureChanged ? userStore.info?.id : marker.pictureCreatorId,
    }
  }

  const { tryUploadPicture } = usePictureUpload()

  const {
    refresh: submit,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async () => {
      const localMarker = markerData.value
      if (!localMarker) throw new Error('表单数据为空')
      await editorRef.value?.validate()
      const form = buildAdminMarkerForm(localMarker)
      await tryUploadPicture(form)
      await markerStore.updateMarker(form)
    },
  })

  onSuccess(async () => {
    ElMessage.success({
      message: '编辑点位成功',
    })
  })

  onError(error => {
    ElMessage.error({
      message: `编辑点位失败，原因为：${error.message}`,
    })
  })

  return { submit, onSuccess, onError, ...rest }
}
