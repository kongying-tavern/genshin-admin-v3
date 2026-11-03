import type { IconVo } from '@/api/alova/globals'
import db from '@/database'
import { useFetchHook } from '@/hooks'

export const useIconOptions = () => {
  const tagOptions = ref<(IconVo & { label: string; value: string })[]>([])

  const {
    loading,
    refresh: getTagList,
    onSuccess,
    ...rest
  } = useFetchHook({
    immediate: true,
    onRequest: (query: string) =>
      db.icon.filter(icon => (!query ? true : (icon.tag?.includes(query) ?? false))).toArray(),
  })

  onSuccess(tagList => {
    tagOptions.value = tagList.map(tag => ({
      label: tag.tag!,
      value: tag.tag!,
      ...tag,
    }))
  })

  return { tagOptions, loading, getTagList, onSuccess, ...rest }
}
