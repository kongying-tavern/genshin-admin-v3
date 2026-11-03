import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'
import { getFileType } from '@/utils'

export const useImageLoad = () => {
  const localImage = shallowRef<Blob>()
  const localImageBitmap = shallowRef<ImageBitmap>()

  watch(localImage, async () => {
    if (!localImage.value) {
      localImageBitmap.value = undefined
      return
    }
    localImageBitmap.value = await createImageBitmap(localImage.value)
  })

  const {
    refresh: loadLocalImage,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    initialValue: undefined,
    shallow: true,
    onRequest: () =>
      new Promise<Blob | undefined>((resolve, reject) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.multiple = false

        input.oncancel = () => {
          input.remove()
          resolve(undefined)
        }

        input.oninput = async () => {
          const file = input.files?.[0]
          input.remove()

          if (!file) return resolve(undefined)

          const realType = await getFileType(file)
          if (realType === 'unknown') return reject(new Error('不支持的图片类型'))

          resolve(file)
        }

        input.click()
      }),
  })

  const localImageUrl = useObjectUrl(localImage)

  onSuccess(image => {
    if (!image) return
    localImage.value = image
  })

  onError(err =>
    ElMessage.error({
      message: `加载图片失败，原因为：${err.message}`,
    }),
  )

  return {
    localImage,
    localImageBitmap,
    localImageUrl,
    loadLocalImage,
    onSuccess,
    onError,
    ...rest,
  }
}
