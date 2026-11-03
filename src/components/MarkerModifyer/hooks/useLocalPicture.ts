import { useFetchHook } from '@/hooks'
import { getFileType } from '@/utils'

export const useLocalPicture = () => {
  const { data: localPicture, ...rest } = useFetchHook({
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

  const localPictureUrl = useObjectUrl(localPicture)

  const clear = () => {
    localPicture.value = undefined
  }

  return {
    localPicture,
    localPictureUrl,
    clear,
    ...rest,
  }
}
