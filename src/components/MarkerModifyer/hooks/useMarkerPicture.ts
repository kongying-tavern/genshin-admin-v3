import { useFetchHook } from '@/hooks'

export const useMarkerPicture = (picture: Ref<string | undefined>) => {
  const thumbImage = shallowRef<Blob>()
  const thumbImageUrl = useObjectUrl(thumbImage)

  const {
    loading: initLoading,
    refresh: initPicture,
    onSuccess: onInitSuccess,
  } = useFetchHook({
    shallow: true,
    initialValue: undefined,
    onRequest: async () => {
      const pictureUrl = picture.value
      if (!pictureUrl || pictureUrl.toLowerCase().startsWith('blob:')) return

      const { protocol, pathname } = new URL(pictureUrl)

      if (!['http:', 'https:'].includes(protocol)) throw new Error(`协议 "${protocol}" 不支持`)

      const paths = pathname.split('/')

      const nameunits = paths.at(-1)!.split('.')
      if (!nameunits || nameunits.length < 2)
        throw new Error(`路径 "${pathname}" 未包含可解析的文件名`)

      // 加载缩略图
      const thumb = await fetch(pictureUrl, { mode: 'cors' })
        .then(r => r.blob())
        .catch(() => undefined)

      return thumb
    },
  })

  onInitSuccess(thumb => {
    thumbImage.value = thumb
  })

  watch(picture, initPicture, { immediate: true })

  return {
    initPicture,
    initLoading,
    thumbImageUrl,
  }
}
